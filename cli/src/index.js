const { Command, flags } = require("@oclif/command");
const wflow = require("../../wflow");

class CliCommand extends Command {
  async run() {
    const { flags } = this.parse(CliCommand);
    wflow(flags);
  }
}

CliCommand.description = `🐆 Runs GitHub Actions workflows locally for testing

To see wflow in action, try this:

  wflow

Likely you'll want to run your own workflow. Try this:

  wflow --file workflows/parallel.yml

Sometimes you just want to test a single job. Well then!

  wflow --file workflows/parallel.yml --job job1

If you don't specify an --event, it attempts to create an event from your .git directory.

An event is analogous to a GitHub webhook payload.

All of the above should open up a browser, so you can have some realtime enjoyment.
`;

CliCommand.flags = {
  // add --version flag to show CLI version
  version: flags.version({ char: "v" }),
  // add --help flag to show CLI version
  help: flags.help({ char: "h" }),
  file: flags.string({ char: "f", description: "Path to workflow.yml" }),
  job: flags.string({ char: "j", description: "Name of isolated job from the worlkflow to run" }),
  event: flags.string({ char: "e", description: "Path to event.json" }),
  dev: flags.boolean({ char: "d", description: "Starts the stack in dev mode" })
};

module.exports = CliCommand;
