const logger = require("signale");

/**
 * Returns correct docker image given runs-on
 *
 * @param {*} job
 */
function getImage(job) {
  let imageMap = {
    "ubuntu-latest": "phishy/wflow-ubuntu-latest"
  };
  if (!(job["runs-on"] in imageMap)) {
    logger.error(`Unsupported runs-on in ${job.id} (ubuntu-latest only)`);
    process.exit(1);
  }
  return imageMap[job["runs-on"]];
}

module.exports = getImage;
