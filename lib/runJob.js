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

    // Handles special checkout plugin
    // if (step.uses && step.uses.indexOf("actions/checkout") >= 0) {
    //   let repo =
    //     workflow.event.repository.ssh_url ||
    //     workflow.event.repository.clone_url;
    //   let stack = [];
    //   stack.push(`cd ${codePath}`);
    //   stack.push(`git clone ${repo} . 2> ${logPath}/${stepName}.log`);
    //   logger.debug(stack.join(";"));
    //   try {
    //     await axios.patch(`http://localhost:3000/steps/${step._id}`, {
    //       status: "incomplete"
    //     });
    //     await execa.command(stack.join(";"), { shell: true });
    //     await axios.patch(`http://localhost:3000/steps/${step._id}`, {
    //       status: "complete"
    //     });
    //     return;
    //   } catch (e) {
    //     logger.error("Failed to checkout repo");
    //     logger.error(stack.join(";"));
    //     logger.error(e);
    //     process.exit(1);
    //   }
    // }

    // Since we're not using VMs yet, this allows docker to be run inside docker by mounting
    // in the docker socket and binary/
    // let dockerInDocker =
    //   "-v /var/run/docker.sock:/var/run/docker.sock -v /usr/local/bin/docker:/usr/bin/docker";

    // Steps to use an actual GitHub Action
    // if (step.uses) {
    //   let stack = [];

    // var args = "";
    // var entrypoint = "";

    // if (step.uses.indexOf("docker://") === 0) {
    //   var [org, repoVersion] = step.uses.replace("docker://", "").split("/");
    //   var [repo, version] = repoVersion.split("@");
    //   var action = `${org}/${repo}`;
    //   if (step.with.entrypoint) {
    //     entrypoint = `--entrypoint ${step.with.entrypoint}`;
    //   }
    //   if (step.with.args) {
    //     args = `${step.with.args}`;
    //   }
    // } else {
    //   var [org, repoVersion] = step.uses.split("/");
    //   var [repo, version] = repoVersion.split("@");
    //   let actionPath = `${workPath}/actions/${org}/${repo}`;
    //   var action = `${org}/${repo}`;
    //   stack.push(
    //     `git clone https://github.com/${org}/${repo}.git ${actionPath}`
    //   );
    //   stack.push(`cd ${actionPath}`);
    //   stack.push(`docker build -t ${action} .`);
    // }

    //   stack.push(
    //     `docker run -l wflow --log-driver syslog --log-opt syslog-address=udp://${internalIp.v4.sync()}:${
    //       step.syslog.port
    //     } -v ${codePath}:/code ${action.env(secrets)} ${dockerInDocker} ${entrypoint} ${action} ${args}`
    //   );
    //   try {
    //     await axios.patch(`http://localhost:3000/steps/${step._id}`, {
    //       status: "incomplete"
    //     });
    //     logger.info("Step started");
    //     await execa.command(stack.join(";"), { shell: true });
    //     logger.success("Step complete");
    //     await axios.patch(`http://localhost:3000/steps/${step._id}`, {
    //       status: "complete"
    //     });
    //     step.syslog.server.stop();
    //     return;
    //   } catch (e) {
    //     logger.error("Failed to run command");
    //     logger.error(stack.join(";"));
    //     process.exit(1);
    //   }
    // }

    // if (step.run) {
    //   let cmd = `docker run -l wflow --name ${stepName} --log-driver syslog --log-opt syslog-address=udp://${internalIp.v4.sync()}:${
    //     step.syslog.port
    //   } --rm -v ${job.path.workspace}:${job.path.workspace} ${action.env(
    //     params.secrets
    //   )} ${dockerInDocker} ${job.image} bash -c 'cd ${job.path.workspace}; ${
    //     step.run
    //   }'`;
    //   logger.debug(cmd);

    //   try {
    //     await axios.patch(`http://localhost:3000/steps/${step._id}`, {
    //       status: "incomplete"
    //     });
    //     logger.info("Step started");
    //     await execa(cmd, { shell: true });
    //     logger.success("Step complete");
    //     await axios.patch(`http://localhost:3000/steps/${step._id}`, {
    //       status: "complete"
    //     });
    //     step.syslog.server.stop();
    //   } catch (e) {
    //     logger.error(`Failed to run command`);
    //     logger.error(cmd);
    //     logger.error(e);
    //     process.exit(1);
    //   }
    // }
  });
}

module.exports = run;
