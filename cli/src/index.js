const { Command, flags } = require("@oclif/command");
const runner = require("../../runner");

class CliCommand extends Command {
  async run() {
    const { flags } = this.parse(CliCommand);
    runner(flags);
  }
}

CliCommand.description = `🐆 Runs GitHub Actions workflows locally for testing

To see wflow in action, try this:

  wflow

Likely you'll want to run your own workflow. Try this:

  wflow --file workflows/parallel.yml

Sometimes you just want to test a single job. Well then!

  wflow --file workflows/parallel.yml --job job1

All of the above should open up a browser, so you can have some realtime enjoyment.
`;

CliCommand.flags = {
  // add --version flag to show CLI version
  version: flags.version({ char: "v" }),
  // add --help flag to show CLI version
  help: flags.help({ char: "h" }),
  file: flags.string({ char: "f", description: "Path to workflow file" }),
  job: flags.string({ char: "j", description: "Name of isolated job to run" })
};

module.exports = CliCommand;
