const yaml = require("js-yaml");
const fs = require("fs");

function load(path) {
  return yaml.safeLoad(
    fs.readFileSync(path, "utf8")
  );
}

module.exports.load = load;

