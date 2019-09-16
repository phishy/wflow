const mustache = require("mustache");

/**
 * Generates an env string for use in a docker command from an object
 *
 * @param {*} step
 */
function generateEnv(step, secrets) {
  var envStr = "";
  if (step.env) {
    Object.keys(step.env).forEach(name => {
      if (step.env[name].indexOf("$") === 0) {
        let token = step.env[name].replace('{{', '{{{').replace('}}', '}}}');
        let val = mustache.render(token.replace("$", ""), {
          secrets
        });
        envStr += `-e ${name}=${val} `;
      } else {
        envStr += `-e ${name}=${step.env[name]} `;
      }
    });
  }
  return envStr;
}

module.exports = generateEnv;
