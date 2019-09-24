const logger = require("signale");
const mkdir = require("./mkdir");
const tempDirectory = require("temp-dir");

class Job {
  constructor(params) {
    this.run = params.run;
    this.job = params.job;
    this.secrets = params.secrets;
    this.ports = params.ports;
    this.image = "";
    this.path = {
      base: "",
      logs: "",
      workspace: ""
    };
  }
  /**
   * Determines machine image to use for the job
   *
   */
  image() {
    let imageMap = {
      "ubuntu-latest": "phishy/wflow-ubuntu-latest"
    };
    if (!(job["runs-on"] in imageMap)) {
      logger.error(`Unsupported runs-on in ${job.id} (ubuntu-latest only)`);
      process.exit(1);
    }
    return (this.image = imageMap[job["runs-on"]]);
  }
  /**
   * Creates file workspaces for the job
   *
   */
  async createWorkspace() {
    var basePath = `${tempDirectory}/wflow`;
    var workPath = `${basePath}/${this.job.run}/workspaces/${this.job._id}`;
    var codePath = `${workPath}/code`;
    var logPath = `${workPath}/logs`;

    this.path.base = workPath;
    this.path.workspace = codePath;
    this.path.logs = logPath;
    this.path.actions = `${workPath}/actions`;

    try {
      await mkdir(`${basePath}`, { recursive: true });
    } catch (e) {
      // logger.info(`${basePath} already existed. But that's ok`);
    }

    try {
      await mkdir(`${basePath}/data`, { recursive: true });
    } catch (e) {
      // logger.info(`${basePath}/data already existed. But that's ok`);
    }

    try {
      await mkdir(workPath, { recursive: true });
    } catch (e) {
      // logger.info(`workPath already existed. But that's ok`);
    }

    try {
      await mkdir(codePath, { recursive: true });
      await mkdir(logPath, { recursive: true });
    } catch (e) {
      logger.error(e);
    }
    return {
      workPath,
      codePath,
      logPath
    };
  }
}

module.exports = Job;
