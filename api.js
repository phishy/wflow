const _ = require("lodash");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const logger = require("signale");
const runJob = require("./lib/job");
const envfile = require("envfile");
const fileExists = require("file-exists");
const findFreePorts = require("find-free-ports");
const Datastore = require("nedb-promises");

const app = express();
const port = 3000;
app.use(cors());
app.use(bodyParser.json());

let db = {};
db.runs = Datastore.create("./data/runs.db");
db.jobs = Datastore.create("./data/jobs.db");
db.steps = Datastore.create("./data/steps.db");

app.post("/runs", async (req, res) => {
  var workflow = req.body;
  workflow.status = "incomplete";

  var wRes = await db.runs.insert(workflow);
  workflow._id = wRes._id;

  for (let jobId in workflow.jobs) {
    let job = workflow.jobs[jobId];

    var jRes = await db.jobs.insert({
      workflow: wRes._id,
      id: jobId,
      status: "waiting",
      name: job.name,
      needs: job.needs,
      "runs-on": job["runs-on"]
    });
    job._id = jRes._id;

    for (let key in workflow.jobs[jobId].steps) {
      let step = workflow.jobs[jobId].steps[key];

      var sRes = await db.steps.insert({
        workflow: wRes._id,
        job: jRes._id,
        status: "incomplete",
        name: step.name,
        uses: step.uses,
        run: step.run,
        env: step.env,
        port: step.port
      });
      step._id = sRes._id;
    }
  }
  res.send(workflow);
});

app.patch("/runs/:id", async (req, res) => {
  await db.runs.update({ _id: req.params.id }, { $set: req.body });
  res.sendStatus(200);
});

app.get("/runs/:id", async (req, res) => {
  res.send(await db.runs.findOne({ _id: req.params.id }));
});

app.post("/jobs", async (req, res) => {
  res.send(await db.jobs.insert(req.body));
});

app.patch("/jobs/:id", async (req, res) => {
  await db.jobs.update({ _id: req.params.id }, { $set: req.body });
  res.sendStatus(200);
});

app.get("/jobs/:id", async (req, res) => {
  res.send(await db.jobs.findOne({ _id: req.params.id }));
});

app.post("/steps", async (req, res) => {
  res.send(await db.steps.insert(req.body));
});

app.patch("/steps/:id", async (req, res) => {
  let stepId = req.params.id;
  await db.steps.update({ _id: stepId }, { $set: req.body });
  updateJobStatus(stepId);
  res.sendStatus(200);
});

app.get("/steps/:id", async (req, res) => {
  res.send(await db.steps.findOne({ _id: req.params.id }));
});

async function updateJobStatus(stepId) {
  let step = await db.steps.findOne({ _id: stepId });
  let steps = await db.steps.find({ job: step.job });
  if (_.every(steps, { status: "complete" })) {
    logger.info("Job completed");
    await db.jobs.update({ _id: step.job }, { $set: { status: "complete" } });
    checkSchedule(step.workflow);
  }
}

async function checkSchedule(workflowId) {
  let jobs = await db.jobs.find({ workflow: workflowId, status: "waiting" });
  for (let jobIndex in jobs) {
    var needsCompleted = 0;
    if ('needs' in jobs[jobIndex]) {
      var needsNeeded = 0;
    } else {
      var needsNeeded = jobs[jobIndex].needs.length;
    }
    for (let stepIndex in jobs[jobIndex].needs) {
      let stepId = jobs[jobIndex].needs[stepIndex];
      let job = await db.jobs.find({
        workflow: workflowId,
        id: stepId,
        status: "complete"
      });
      let isComplete = job.length;
      if (isComplete) {
        needsCompleted++;
      }
      if (needsCompleted == needsNeeded) {
        submitJob(jobs[jobIndex]._id);
      }
    }
  }
}

async function submitJob(jobId) {
  let job = await db.jobs.findOne({ _id: jobId });
  let run = await db.runs.findOne({ _id: job.workflow });
  job.steps = await db.steps.find({ job: job._id });

  var secrets;
  if (fileExists.sync("./secrets.env")) {
    secrets = envfile.parseFileSync("./secrets.env");
  }

  let ports = await findFreePorts(job.steps.length);

  runJob(run, secrets, job, ports);
}

module.exports = {
  start: () =>
    new Promise((resolve, reject) => {
      app.listen(port, () => {
        logger.start(`Workflow API listening on port ${port}!`);
        resolve();
      });
    })
};
