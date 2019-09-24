const _ = require("lodash");
const logger = require("signale");
const fileExists = require("file-exists");
const findFreePorts = require("find-free-ports");
const Datastore = require("nedb-promises");
const dotenv = require('dotenv');
const fs = require('fs');
const tempDirectory = require("temp-dir");

const runJob = require("./lib/runJob");

var app = require("express")();
var http = require("http").createServer(app);
var io = require("socket.io")(http);
const cors = require("cors");
const bodyParser = require("body-parser");
app.use(cors());
app.use(bodyParser.json());

let db = {};
db.runs = Datastore.create(`${tempDirectory}/wflow/data/runs.db`);
db.jobs = Datastore.create(`${tempDirectory}/wflow/data/jobs.db`);
db.steps = Datastore.create(`${tempDirectory}/wflow/data/steps.db`);

app.get('/', (req, res)=>{
  res.send('Hello!');
});

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
    job.id = jRes.id;
    job.run = wRes._id;

    for (let key in workflow.jobs[jobId].steps) {
      let step = workflow.jobs[jobId].steps[key];

      var sRes = await db.steps.insert({
        workflow: wRes._id,
        job: jRes._id,
        status: "waiting",
        name: step.name,
        uses: step.uses,
        run: step.run,
        env: step.env,
        port: step.port,
        realtime: step.realtime
      });
      step._id = sRes._id;
    }
  }
  io.emit("update", await getRun(workflow._id));
  res.send(workflow);
});

app.patch("/runs/:id", async (req, res) => {
  await db.runs.update({ _id: req.params.id }, { $set: req.body });
  res.sendStatus(200);
});

app.get("/runs/:id", async (req, res) => {
  let run = await getRun(req.params.id);
  res.send(run);
});

/**
 * Re-assembles a run from its component records. Think ORM.
 *
 * @param {*} id
 */
async function getRun(id) {
  let run = await db.runs.findOne({ _id: id });
  run.jobs = {};
  let jobs = await db.jobs.find({ workflow: run._id });
  for(let jobKey in jobs) {
    let job = jobs[jobKey];
    let steps = await db.steps.find({ job: job._id });
    job.steps = steps;
    run.jobs[job.id] = job;
  }
  return run;
}

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
  let step = await db.steps.findOne({ _id: stepId });
  await db.steps.update({ _id: stepId }, { $set: req.body });
  io.emit("update", await getRun(step.workflow));
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
    logger.success("Job completed");
    await db.jobs.update({ _id: step.job }, { $set: { status: "complete" } });
    io.emit('update', await getRun(step.workflow));
    updateRunStatus(step.workflow);
    checkSchedule(step.workflow);
  }
}

async function updateRunStatus(runId) {
  let jobs = await db.jobs.find({ workflow: runId });
  let complete = 0;
  jobs.forEach(job => {
    if (job.status == "complete") {
      complete++;
    }
  });
  if (complete == jobs.length) {
    await db.runs.update({ _id: runId }, { $set: { status: "complete" } });
    logger.info(`Run completed: ${runId}`);
    io.emit("update", await getRun(runId));
  }
}

async function checkSchedule(workflowId) {
  let jobs = await db.jobs.find({ workflow: workflowId, status: "waiting" });
  for (let jobIndex in jobs) {
    var needsCompleted = 0;
    var needsNeeded = (jobs[jobIndex].needs) ? jobs[jobIndex].needs.length : 0;
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
    const buf = Buffer.from(fs.readFileSync("./secrets.env"));
    secrets = dotenv.parse(buf);
  }

  let ports = await findFreePorts(job.steps.length);

  runJob(run, secrets, job, ports);
}

module.exports = {
  start: () =>
    new Promise((resolve, reject) => {
      http.listen(3000, () => {
        logger.start(`Workflow API listening on port 3000!`);
        resolve();
      });
    })
};
