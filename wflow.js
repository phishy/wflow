const which = require("which");
const execa = require("execa");
const logger = require("signale");
const git = require("async-git");
const fileExists = require("file-exists");
const fs = require("fs");
const GitUrlParse = require("git-url-parse");
const open = require("open");
const axios = require("axios");
const dotenv = require("dotenv");
const searchhash = require("searchhash");
const yaml = require("js-yaml");
const internalIp = require("internal-ip");
const tempDirectory = require("temp-dir");
const rimraf = require("rimraf");
const socket = require("socket.io-client");

const config = require("./wflow.json");
const Workflow = require("./lib/workflow");

const ui = require("./ui");
const api = require("./api");
config.ip = internalIp.v4.sync();

/**
 * Configuration
 */
Object.assign(config, {
  api: `http://${config.ip}:3000`,
  ui: `http://${config.ip}:3001`
});

async function main(flags) {
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
    if (stdout.indexOf("https://") >= 0) {
      event.repository.clone_url = stdout;
    }
    if (stdout.indexOf("git@") >= 0) {
      event.repository.ssh_url = stdout;
      event.repository.clone_url = GitUrlParse(stdout).toString("https");
    }
  } else {
    logger.info(`Using commit information from --event ${flags.event}`);
    var event = require(`./${flags.event}`);
    event.path = flags.event;
  }

  if (!flags.dev) {
    await ui.start();
  }

  await api.start();

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
    yamlWorkflow.event = require("./work/_temp/event.json");
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

  fs.writeFileSync("./work/_temp/event.json", JSON.stringify(event));
  fs.writeFileSync("./work/_temp/secrets.env", secrets);

  open(`${config.ui}/runs/${run.data._id}`);

  let cmd = `
  docker run -i --rm \
  -l wflow \
  -v $PWD:/home/runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /usr/local/bin/docker:/usr/bin/docker \
  phishy/wflow-runner-ubuntu-latest ${config.ip} ${run.data._id}
  `;

  try {
    await execa.command(cmd, { shell: true });
  } catch (e) {
    logger.error(`Failed to initiate runner`);
    logger.error(e.stderr);
    logger.error(e.stdout);
    logger.error(cmd);
    process.exit(1);
  }
}

/**
 * Terminates the CLI when the job is complete
 */
let socketClient = new socket(config.api);
socketClient.on("update", function(run) {
  if (run.status == "complete") {
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

module.exports = main;
