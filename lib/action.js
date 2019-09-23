class Action {
  constructor(params) {
    this.name = "";
    this.args = "";
    this.entrypoint = "";
    this.repo = "";
    this.org = "";
    this.version = "";

    this.stack = [];
    this.path = '';
    this.uses = params.uses;
    this.with = params.with;
    this.run = params.run;
    this.step = params.step;
    // git clone https://github.com/${org}/${repo}.git ${actionPath}
    // cd ${actionPath}

    // actions.yml
    // -- plugin
    // -- docker
    // -- main

    // docker build -t ${action} .

    // entrypoint
    // action
    // args
    // with?
  }
  parseUses(uses) {
    if (!this.step.uses) {
      return false;
    }
    if (this.step.uses.indexOf("docker://") === 0) {
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
      var [org, repoVersion] = this.step.uses.split("/");
      var [repo, version] = repoVersion.split("@");
      this.path = `${this.run.path.action}/${org}/${repo}`;
    }
    this.repo = repo;
    this.version = version;
    this.org = org;
    this.name = `${org}/${repo}`;
  }
  run() {
    let envStr = "";
    let dockerInDocker = "";
    return `docker run -l wflow --log-driver syslog --log-opt syslog-address=udp://${this.run.ip}:${this.step.syslog.port} -v ${this.step.workspace}:/code ${envStr} ${dockerInDocker} ${this.entrypoint} ${this.name} ${this.args}`;
  }
}

module.exports = Action;
