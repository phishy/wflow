const findFreePorts = require("find-free-ports");

class Workflow {
  constructor(data) {
    this.data = data;
    this.ports = [];
  }
  async init() {
    this.ports = await this.reservePorts();
    Object.keys(this.data.jobs).forEach(jobName => {
      let job = this.data.jobs[jobName];
      Object.keys(job.steps).forEach(async name => {
        let port = this.ports.pop();
        this.data.jobs[jobName].steps[name].port = port;
        this.data.jobs[jobName].steps[name].realtime = `ws://localhost:${port}`;
      });
    });
  }
  reservePorts() {
    let stepCount = 0;
    for (let jobName in this.data.jobs) {
      stepCount += this.data.jobs[jobName].steps.length;
    }
    return findFreePorts(stepCount * 2);
  }
}

module.exports = Workflow;
