const path = require("path");
const mkdir = require("./mkdir");

/**
 * Creates necessary folders and paths in order to do work
 *
 * @param {*} job
 */
async function createWorkspace(job) {
  let workPath = path.resolve(`./workspaces/${job._id}`);
  let codePath = `${workPath}/code`;
  let logPath = `${workPath}/logs`;
  try {
    await mkdir(workPath);
    await mkdir(codePath);
    await mkdir(logPath);
  } catch (e) {
    // @todo fix hack
  }
  return {
    workPath,
    codePath,
    logPath
  };
}

module.exports = createWorkspace;
