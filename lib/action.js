const execa = require("execa");
const mustache = require("mustache");
const logger = require("signale");
const loadYaml = require("./loadYaml");

let checkout = require(`../plugins/checkout`);

/**
 * Turns YAML and secrets into actionable docker commands
 */
class Action {
  constructor(params) {
    this.name = "";
    this.type = "";
    this.args = "";
    this.entrypoint = "";
    this.repo = "";
    this.org = "";
    this.version = "";
    this.stack = [];
    this.path = "";
    this.uses = params.uses;
    this.with = params.with;
    this.run = params.run;
    this.step = params.step;
    this.secrets = params.secrets;
    this.job = params.job;
    this.event = params.event;
    this.parseUses();
  }
  parseUses(uses) {
    if (!this.step.uses) {
      return false;
    }
    if (this.step.uses.indexOf("docker://") === 0) {
      this.type = "image";
      var [org, repoVersion] = this.step.uses
        .replace("docker://", "")
        .split("/");
      var [repo, version] = repoVersion.split("@");

      if (this.step.with.entrypoint) {
        this.entrypoint = `--entrypoint ${this.step.with.entrypoint}`;
      }
      if (this.step.with.args) {
        this.args = `${this.step.with.args}`;
      }
    } else {
      this.type = "repo";
      var [org, repoVersion] = this.step.uses.split("/");
      var [repo, version] = repoVersion.split("@");
      this.path = `${this.job.path.actions}/${org}/${repo}`;
    }
    this.repo = repo;
    this.version = version;
    this.org = org;
    this.name = `${org}/${repo}`;
  }
  /**
   * Returns an env string to pass to docker given global secrets and step format
   */
  env() {
    let secrets = this.secrets;
    let envStr = "";
    if (this.step.env) {
      Object.keys(this.step.env).forEach(name => {
        if (String(this.step.env[name]).indexOf("$") === 0) {
          let token = this.step.env[name]
            .replace("{{", "{{{")
            .replace("}}", "}}}");
          let val = mustache.render(token.replace("$", ""), {
            secrets
          });
          envStr += `-e ${name}=${val} `;
        } else {
          envStr += `-e ${name}=${this.step.env[name]} `;
        }
      });
    }
    return envStr;
  }
  /**
   * Runs special system plugins
   *
   * @param string plugin
   */
  async plugin(plugin) {
    switch (plugin) {
      case "checkout":
        let repo =
          this.run.event.repository.ssh_url ||
          this.run.event.repository.clone_url;
        let inputs = {
          repository: repo,
          path: this.job.path.workspace
        };
        await checkout({
          inputs
        });
        return true;
        break;
      default:
        throw new Error(`Unsupported plugin ${actionConfig.runs.plugin}`);
    }
  }
  /**
   * Builds a stack of docker commands and executes them
   */
  async execute() {
    if (this.type === "repo") {
      try {
        var cmd = `git clone https://github.com/${this.org}/${this.repo}.git ${this.path}`;
        await execa.command(cmd, { shell: true });
      } catch (e) {
        let err = `Failed to clone action: ${cmd}`;
        logger.error(err);
        throw new Error(err);
      }
      let actionConfig = loadYaml.load(`${this.path}/action.yml`);
      if (actionConfig.runs.plugin) {
        return this.plugin(actionConfig.runs.plugin);
      }
      if (actionConfig.runs.using === "docker") {
        this.stack.push(
          `docker build -t ${this.name} -f ${actionConfig.runs.image} ${this.path}`
        );
      }
    }

    var dockerInDocker =
      "-v /var/run/docker.sock:/var/run/docker.sock -v /usr/local/bin/docker:/usr/bin/docker";

    if (this.step.uses) {
      this.stack.push(
        `docker run -l wflow --log-driver syslog --log-opt syslog-address=udp://${
          this.run.ip
        }:${this.step.syslog.port} -v ${
          this.job.path.workspace
        }:/code ${this.env(this.secrets)} ${dockerInDocker} ${
          this.entrypoint
        } ${this.name} ${this.args}`
      );
    }

    if (this.step.run) {
      let stepName = `${this.run._id}-step-${this.step._id}`;
      let cmd = `docker run -l wflow --name ${stepName} --log-driver syslog --log-opt syslog-address=udp://${
        this.run.ip
      }:${this.step.syslog.port} --rm -v ${this.job.path.workspace}:${
        this.job.path.workspace
      } ${this.env(this.secrets)} ${dockerInDocker} ${
        this.job.image
      } bash -c 'cd ${this.job.path.workspace}; ${this.step.run}'`;
      this.stack.push(cmd);
    }

    try {
      await execa.command(this.stack.join(";"), { shell: true });
    } catch (e) {
      let err = "Failed to run command";
      logger.error(err);
      logger.error(this.stack.join(";"));
      logger.error(e);
      throw new Error(err);
    }
  }
}

module.exports = Action;
