const mkdir = require("./mkdir");
const tempDirectory = require("temp-dir");

/**
 * Creates necessary folders and paths in order to do work
 *
 * @param {*} job
 */
async function createWorkspace(job) {
  var basePath = `${tempDirectory}/wflow`;
  var workPath = `${basePath}/workspaces/${job._id}`;
  var codePath = `${workPath}/code`;
  var logPath  = `${workPath}/logs`;
  try {
    await mkdir(`${basePath}`);
    await mkdir(`${basePath}/workspaces`);
    await mkdir(`${basePath}/data`);
  } catch (e) {
    // nada
  }
  await mkdir(workPath);
  await mkdir(codePath);
  await mkdir(logPath);
  return {
    workPath,
    codePath,
    logPath
  };
}

module.exports = createWorkspace;
