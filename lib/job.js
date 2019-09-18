const execa = require("execa");
const asyncForEach = require("./asyncForEach");
const createWorkspace = require("./createWorkspace");
const getImage = require("./getImage");
const generateEnv = require("./generateEnv");
const logger = require("signale");
const SyslogServer = require("./syslog-server");
const fs = require("fs");
const axios = require("axios");

/**
 * Main workflow runnner
 *
 * @param {*} workflowId
 * @param {*} event
 * @param {*} secrets
 * @param {*} job
 */
async function run(workflow, secrets, job, ports) {

  var image = getImage(job);
  let { workPath, codePath, logPath } = await createWorkspace(job);

  await axios.patch(`http://localhost:3000/jobs/${job._id}`, {
    status: "incomplete"
  });

  asyncForEach(job.steps, async step => {
    var stepName = `${workflow._id}-step-${step._id}`;

    step.syslog = {
      port: ports.pop(),
      server: new SyslogServer(),
      broadcasting: false
    };

    step.syslog.server.on("message", data => {
      let [time, msg] = data.message.split("]: ");
      fs.appendFile(`${logPath}/${stepName}.log`, msg, err => {
        if (err) throw err;
        if (step.syslog.broadcasting) {
          return;
        }
        step.syslog.broadcasting = true;
        let cmd = `npx websocketdjs --port ${step.port} tail -f ${logPath}/${stepName}.log`;
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

    Object.assign(step.env || {}, {
      GITHUB_SHA: workflow.event.after,
      GITHUB_REF: workflow.event.ref
    });

    var envStr = generateEnv(step, secrets);

    // Handles special checkout plugin
    if (step.uses == "actions/checkout@v1") {
      let repo =
        workflow.event.repository.ssh_url ||
        workflow.event.repository.clone_url;
      let stack = [];
      stack.push(`cd ${codePath}`);
      stack.push(`git clone ${repo} . 2> ${logPath}/${stepName}.log`);
      logger.debug(stack.join(";"));
      try {
        await axios.patch(`http://localhost:3000/steps/${step._id}`, {
          status: "incomplete"
        });
        await execa.command(stack.join(";"), { shell: true });
        await axios.patch(`http://localhost:3000/steps/${step._id}`, {
          status: "complete"
        });
        return;
      } catch (e) {
        logger.error("Failed to checkout repo");
        logger.error(stack.join(";"));
        logger.error(e);
        process.exit(1);
      }
    }

    // Since we're not using VMs yet, this allows docker to be run inside docker by mounting
    // in the docker socket and binary/
    let dockerInDocker =
      "-v /var/run/docker.sock:/var/run/docker.sock -v /usr/local/bin/docker:/usr/bin/docker";

    // Steps to use an actual GitHub Action
    if (step.uses) {
      let stack = [];

      var args = "";
      var entrypoint = "";

      if (step.uses.indexOf("docker://") === 0) {
        var [org, repoVersion] = step.uses.replace("docker://", "").split("/");
        var [repo, version] = repoVersion.split("@");
        var action = `${org}/${repo}`;
        if (step.with.entrypoint) {
          entrypoint = `--entrypoint ${step.with.entrypoint}`;
        }
        if (step.with.args) {
          args = `${step.with.args}`;
        }
      } else {
        var [org, repoVersion] = step.uses.split("/");
        var [repo, version] = repoVersion.split("@");
        let actionPath = `${workPath}/actions/${org}/${repo}`;
        var action = `${org}/${repo}`;
        stack.push(
          `git clone https://github.com/${org}/${repo}.git ${actionPath}`
        );
        stack.push(`cd ${actionPath}`);
        stack.push(`docker build -t ${action} .`);
      }

      stack.push(
        `docker run -l wflow --log-driver syslog --log-opt syslog-address=udp://host.docker.internal:${step.syslog.port} -v ${codePath}:/code ${envStr} ${dockerInDocker} ${entrypoint} ${action} ${args}`
      );
      try {
        await axios.patch(`http://localhost:3000/steps/${step._id}`, {
          status: "incomplete"
        });
        logger.info("Step started");
        await execa.command(stack.join(";"), { shell: true });
        logger.success("Step complete");
        await axios.patch(`http://localhost:3000/steps/${step._id}`, {
          status: "complete"
        });
        step.syslog.server.stop();
        return;
      } catch (e) {
        logger.error("Failed to run command");
        logger.error(stack.join(";"));
        process.exit(1);
      }
    }

    if (step.run) {
      let cmd = `docker run -l wflow --name ${stepName} --log-driver syslog --log-opt syslog-address=udp://host.docker.internal:${step.syslog.port} --rm -v ${codePath}:${codePath} ${envStr} ${dockerInDocker} ${image} bash -c 'cd ${codePath}; ${step.run}'`;
      logger.debug(cmd);

      try {
        await axios.patch(`http://localhost:3000/steps/${step._id}`, {
          status: "incomplete"
        });
        logger.info("Step started");
        await execa(cmd, { shell: true });
        logger.success("Step complete");
        await axios.patch(`http://localhost:3000/steps/${step._id}`, {
          status: "complete"
        });
        step.syslog.server.stop();
      } catch (e) {
        logger.error(`Failed to run command`);
        logger.error(cmd);
        logger.error(e);
        process.exit(1);
      }
    }
  });
}

module.exports = run;
