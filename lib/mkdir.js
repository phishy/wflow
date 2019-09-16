const fs = require("fs");
const util = require("util");
const mkdir = util.promisify(fs.mkdir);

module.exports = mkdir;
