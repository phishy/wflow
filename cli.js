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
const searchhash = require("searchhash");

const ui = require("./ui");
const api = require("./api");
const runJob = require("./lib/job");
const Workflow = require("./lib/workflow");

var config = {
  api: "http://localhost:3000",
  ui: "http://localhost:3001"
};

if (!which.sync("docker", { nothrow: true })) {
  logger.error("Docker needs to be installed");
  process.exit(1);
}

if (!which.sync("npx", { nothrow: true })) {
  logger.error("Node.js needs to be installed");
  process.exit(1);
}

if (!argv.file) {
  if (fileExists.sync("./workflows/needs.yml")) {
    argv.file = "./workflows/needs.yml";
  } else {
    logger.error("Please specify a workflow with --file");
    process.exit(1);
  }
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
    var yamlWorkflow = yaml.safeLoad(fs.readFileSync(argv.file, "utf8"));

    // check to see if you're referencing secrets but have no secrets.env file
    if (!fileExists.sync("./secrets.env")) {
      let found = searchhash.forKey(yamlWorkflow, "env");
      found.results.forEach(res => {
        for (let key in res.value) {
          if (res.value[key].indexOf("secrets.") >= 0) {
            logger.error(
              "Your workflow requires secrets. Please create a secrets.env file"
            );
            process.exit(1);
          }
        }
      });
    }
  } catch (e) {
    logger.error(`Failed to parse workflow yaml for ${argv.file}`);
    logger.error(e);
    process.exit(1);
  }

  try {
    yamlWorkflow.event = event;
    workflow = new Workflow(yamlWorkflow);
    await workflow.init();
    console.log(JSON.stringify(workflow.data));
    run = await axios.post(`${config.api}/runs`, workflow.data);
    // console.log(run.data);
  } catch (e) {
    logger.error(`Failed to contact API`);
    logger.error(e);
    process.exit(1);
  }

  try {
    var secrets;
    if (fileExists.sync("./secrets.env")) {
      const buf = Buffer.from(fs.readFileSync("./secrets.env"));
      secrets = dotenv.parse(buf);
    }
  } catch (e) {
    logger.error(`Failed to parse secrets in ./secrets.env`);
    logger.error(e);
    process.exit(1);
  }

  open(`${config.ui}/runs/${run.data._id}`);

  // submit jobs with no dependencies
  for (let jobName in run.data.jobs) {
    if (!("needs" in run.data.jobs[jobName])) {
      runJob(run.data, secrets, run.data.jobs[jobName], workflow.ports);
    }
  }
}

main();
