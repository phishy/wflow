#!/usr/bin/env node

const argv = require("yargs").argv;
const yaml = require("js-yaml");
const fs = require("fs");
const fileExists = require("file-exists");
const which = require("which");
const open = require("open");
const execa = require("execa");
const git = require("async-git");
const logger = require("signale");
const axios = require("axios");
const dotenv = require("dotenv");

const ui = require("./ui");
const api = require("./api");
const runJob = require("./lib/job");
const Workflow = require("./lib/workflow");

logger.fav("Let's go!");

if (!which.sync("docker", { nothrow: true })) {
  logger.error("Docker needs to be installed");
  process.exit(1);
}

if (!which.sync("npx", { nothrow: true })) {
  logger.error("Node.js needs to be installed");
  process.exit(1);
}

if (!argv.file) {
  argv.file = './workflows/needs.yml';
}

// MAIN
async function main() {

  await ui.start();
  await api.start();

  if (!argv.event) {
    logger.info("Collecting commit information from .git");
    let { stdout } = await execa.command("git config --get remote.origin.url");
    var event = {
      after: await git.sha,
      sha: await git.sha,
      ref: await git.branch,
      repository: {
        clone_url: null,
        ssh_url: null
      },
      head_commit: {
        message: await git.message
      }
    };
    if (stdout.indexOf("https://")) {
      event.repository.clone_url = stdout;
    }
    if (stdout.indexOf("git@")) {
      event.repository.ssh_url = stdout;
    }
  } else {
    logger.info(`Using commit information from --event ${argv.event}`);
    var event = require(`./${argv.event}`);
  }

  var run;
  var workflow;

  try {
    var config = yaml.safeLoad(fs.readFileSync(argv.file, "utf8"));
    config.event = event;
    workflow = new Workflow(config);
    await workflow.init();
    run = await axios.post("http://localhost:3000/runs", workflow.data);
    // console.log(run.data);
  } catch (e) {
    logger.error(`Failed to parse workflow yaml for ${argv.file}`);
    logger.error(e);
    process.exit(1);
  }

  try {
    var secrets;
    if (fileExists.sync("./secrets.env")) {
      const buf = Buffer.from(fs.readFileSync('./secrets.env'));
      secrets = dotenv.parse(buf);
    }
  } catch (e) {
    logger.error(`Failed to parse secrets in ./secrets.env`);
    logger.error(e);
    process.exit(1);
  }

  open(`http://localhost:3001/runs/${run.data._id}`);

  // submit jobs with no dependencies
  for (let jobName in run.data.jobs) {
    if (!("needs" in run.data.jobs[jobName])) {
      runJob(run.data, secrets, run.data.jobs[jobName], workflow.ports);
    }
  }
}

main();
