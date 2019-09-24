const execa = require("execa");
const asyncForEach = require("./asyncForEach");
const logger = require("signale");
const SyslogServer = require("./syslog-server");
const fs = require("fs");
const axios = require("axios");
const internalIp = require("internal-ip");

const Action = require("./action");
const Job = require("./job");

/**
 * Main workflow runnner
 *
 */
async function run(params) {
  params.run.ip = internalIp.v4.sync();

  let job = new Job({
    run: params.run,
    job: params.job,
    secrets: params.secrets,
    ports: params.ports
  });

  await job.createWorkspace();

  await axios.patch(`http://localhost:3000/jobs/${job.job._id}`, {
    status: "incomplete"
  });

  logger.info(`Started job: ${job.job.id}`);

  asyncForEach(job.job.steps, async step => {
    Object.assign(step.env || {}, {
      GITHUB_SHA: params.run.event.after,
      GITHUB_REF: params.run.event.ref,
      GITHUB_WORKSPACE: job.path.workspace,
      GITHUB_EVENT_PATH: params.run.event.path
    });

    var stepName = `${params.run._id}-step-${step._id}`;

    step.syslog = {
      port: params.ports.pop(),
      server: new SyslogServer(),
      broadcasting: false
    };

    step.syslog.server.on("message", data => {
      let [time, msg] = data.message.split("]: ");
      fs.appendFile(`${job.path.logs}/${stepName}.log`, msg, err => {
        if (err) throw err;
        if (step.syslog.broadcasting) {
          return;
        }
        step.syslog.broadcasting = true;
        let cmd = `npx websocketdjs --port ${step.port} tail -f ${job.path.logs}/${stepName}.log`;
        logger.debug(cmd);
        try {
          execa.command(cmd), { shell: true };
        } catch (e) {
          logger.error("Failed to run websocketdjs");
          logger.error(cmd);
          logger.error(e);
          process.exit(1);
        }
      });
    });

    try {
      logger.debug(`Starting syslog server: ${step.syslog.port}`);
      await step.syslog.server.start({
        port: step.syslog.port,
        exclusive: false
      });
    } catch (e) {
      logger.error("Failed to start syslog for step");
      logger.error(step);
      logger.error(e);
      process.exit(1);
    }

    let action = new Action({
      job: job,
      run: params.run,
      step: step,
      secrets: params.secrets
    });

    try {
      await axios.patch(`http://localhost:3000/steps/${step._id}`, {
        status: "incomplete"
      });
      logger.info("Step started");
      await action.execute();
      logger.success("Step complete");
      await axios.patch(`http://localhost:3000/steps/${step._id}`, {
        status: "complete"
      });
      step.syslog.server.stop();
    } catch (e) {
      logger.error(`Failed to execute action`);
      console.log(e);
    }
  });
}

module.exports = run;
