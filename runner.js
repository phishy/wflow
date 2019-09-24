#!/usr/bin/env node

const yaml = require("js-yaml");
const fs = require("fs");
const fileExists = require("file-exists");
const open = require("open");
const execa = require("execa");
const git = require("async-git");
const logger = require("signale");
const axios = require("axios");
const dotenv = require("dotenv");
const searchhash = require("searchhash");
const which = require("which");
const tempDirectory = require("temp-dir");
const rimraf = require("rimraf");
const socket = require("socket.io-client");

const ui = require("./ui");
const api = require("./api");
const runJob = require("./lib/runJob");
const Workflow = require("./lib/workflow");

/**
 * Configuration
 */
var config = {
  api: "http://localhost:3000",
  ui: "http://localhost:3001"
};

/**
 * Terminates the CLI when the job is complete
 */
let socketClient = new socket(config.api);
socketClient.on("update", function(run) {
  if (run.status == 'complete') {
    shutdown();
  }
});

/**
 * Terminates the CLI on SIGINT
 */
process.on("SIGINT", async function() {
  shutdown();
});

/**
 * Cleans up docker containers, deletes workspaces, and exits.
 */
async function shutdown() {
  logger.pending("Shutting down...");

  // attempts to cleanup docker containers
  await execa.sync(
    'docker kill $(docker ps -q --filter "label=wflow") || true',
    { shell: true }
  );

  // removes all data from workspaces
  rimraf.sync(`${tempDirectory}/wflow`);

  logger.success("Thanks for using Workflow!");
  process.exit();
}

/**
 * This is the meat and potatoes
 *
 * @param {*} flags
 */
async function runner(flags) {
  if (!which.sync("docker", { nothrow: true })) {
    logger.error("Docker needs to be installed");
    process.exit(1);
  }

  if (!which.sync("npx", { nothrow: true })) {
    logger.error("Node.js needs to be installed");
    process.exit(1);
  }

  if (!flags.file) {
    if (fileExists.sync("./workflows/parallel.yml")) {
      flags.file = "./workflows/parallel.yml";
    } else {
      logger.error("Please specify a workflow with --file");
      process.exit(1);
    }
  }

  if (!flags.dev) {
    await ui.start();
  }

  await api.start();

  if (!flags.event) {
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
    logger.info(`Using commit information from --event ${flags.event}`);
    var event = require(`./${flags.event}`);
    event.path = flags.event;
  }

  var run;
  var workflow;

  try {
    var yamlWorkflow = yaml.safeLoad(fs.readFileSync(flags.file, "utf8"));

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
    logger.error(`Failed to parse workflow yaml for ${flags.file}`);
    logger.error(e);
    process.exit(1);
  }

  try {
    yamlWorkflow.event = event;
    workflow = new Workflow(yamlWorkflow);
    await workflow.init();
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

  if (flags.job) {
    if (!(flags.job in run.data.jobs)) {
      logger.error(`Could not find ${flags.job} in workflow`);
      process.exit(1);
    }
    runJob({
      run: run.data,
      secrets: secrets,
      job: run.data.jobs[jobName],
      ports: workflow.ports
    });
  } else {
    // submit jobs with no dependencies
    for (let jobName in run.data.jobs) {
      if (!("needs" in run.data.jobs[jobName])) {
        runJob({
          run: run.data,
          secrets: secrets,
          job: run.data.jobs[jobName],
          ports: workflow.ports
        });
      }
    }
  }

  open(`${config.ui}/runs/${run.data._id}`);
}

module.exports = runner;
