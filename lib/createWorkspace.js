const mkdir = require("./mkdir");
const tempDirectory = require("temp-dir");
const logger = require("signale");

/**
 * Creates necessary folders and paths in order to do work
 *
 * @param {*} job
 */
async function createWorkspace(job) {

  var basePath = `${tempDirectory}/wflow`;
  var workPath = `${basePath}/${job.run}/workspaces/${job._id}`;
  var codePath = `${workPath}/code`;
  var logPath  = `${workPath}/logs`;

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
    await mkdir(logPath,  { recursive: true });
  } catch (e) {
    logger.error(e);
  }
  return {
    workPath,
    codePath,
    logPath
  };
}

module.exports = createWorkspace;
