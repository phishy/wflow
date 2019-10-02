#!/usr/bin/env node

const logger = require("signale");
const axios = require("axios");
const fs = require("fs");

const runJob = require("./lib/runJob");

const args = {
  ip: process.argv[2],
  run: process.argv[3],
  job: process.argv[4]
};

/**
 * Schedules and runs initial jobs for the run
 *
 */
async function main() {

  var secrets = fs.readFileSync('./work/_temp/secrets.env');

  let run = await axios(`http://${args.ip}:3000/runs/${args.run}`);

  if (args.job) {
    if (!(args.job in run.data.jobs)) {
      logger.error(`Could not find ${args.job} in workflow`);
      process.exit(1);
    }
    runJob({
      run: run.data,
      secrets: secrets,
      job: run.data.jobs[args.job],
      ports: run.data.ports
    });
  } else {
    // submit jobs with no dependencies
    for (let jobName in run.data.jobs) {
      if (!("needs" in run.data.jobs[jobName])) {
        runJob({
          run: run.data,
          secrets: secrets,
          job: run.data.jobs[jobName],
          ports: run.data.ports
        });
      }
    }
  }
}

main()
