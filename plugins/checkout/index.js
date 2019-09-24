const execa = require("execa");
const logger = require("signale");

/**
 * Checkout plugin
 *
 * @param {*} params
 */
async function checkout(params) {
  if (!params.inputs.repository) {
    throw new Error('Checkout plugin requires inputs.repository');
  }
  if (!params.inputs.path) {
    throw new Error("Checkout plugin requires inputs.path");
  }
  let defaults = {
    repository: undefined,
    ref: undefined,
    token: undefined,
    clean: true,
    submodules: false,
    lfs: false,
    fetchDepth: 0,
    path: undefined
  };
  let inputs = Object.assign({}, defaults, params.inputs);
  try {
    var cmd = `git clone ${inputs.repository} ${inputs.path}`;``
    await execa.command(cmd, { shell: true });
  } catch (e) {
    logger.error(`Failed to checkout: ${cmd}`);
  }
  return true;
}

module.exports = checkout;
