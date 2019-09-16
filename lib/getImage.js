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
    console.log("Unsupported runs-on");
    process.exit(1);
  }
  return imageMap[job["runs-on"]];
}

module.exports = getImage;
