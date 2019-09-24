const Action = require("./action");

var execa = require("execa");
jest.mock("execa");

var loadYaml = require('./loadYaml');
jest.mock('./loadYaml', () => {
  return {
    load: function() {
      return { runs: { plugin: 'checkout'}}
    }
  }
});

describe("action", () => {
  describe("execute", () => {
    let run = {
      ip: "127.0.0.1",
      event: {
        repository: {
          ssh_url: "https://yo",
          clone_url: "git@yo.com"
        }
      }
    };
    let job = {
      path: {
        base: "/tmp/wflow",
        action: "/tmp/wflow/a1b2c3/b2c3v4/actions",
        workspace: "/tmp/wflow/a1b2c3/b2c3v4/code",
        logs: "/tmp/wflow/a1b2c3/b2c3v4/logs"
      }
    };
    let step = {
      uses: "actions/checkout",
      env: {
        NPM_TOKEN: "${{ secrets.NPM_TOKEN }} "
      },
      syslog: {
        port: "100"
      }
    };
    let secrets = {
      NPM_TOKEN: "a1b2c3"
    };
    let action = new Action({ run, job, step, secrets });
    let res = action.execute();
  });
  describe("env", () => {
    it("should correctly generate env string", () => {
      let params = {
        step: {
          env: {
            NPM_TOKEN: "${{ secrets.NPM_TOKEN }}",
            DEBUG: "1"
          }
        },
        secrets: {
          NPM_TOKEN: "a1b2c3"
        }
      };
      let action = new Action(params);
      let env = action.env();
      expect(env).toBe("-e NPM_TOKEN=a1b2c3 -e DEBUG=1 ");
    });
  });
  describe("parseUses", () => {
    it("docker://phishy/wflow-ubuntu-latest", () => {
      let params = {
        run: {
          ip: "127.0.0.1",
          event: {
            repository: {
              ssh_url: "https://yo",
              clone_url: "git@yo.com"
            }
          }
        },
        env: {},
        step: {
          uses: "docker://phishy/wflow-ubuntu-latest",
          with: {
            entrypoint: "echo",
            args: "hello"
          },
          workspace: "/tmp",
          syslog: {
            port: "1234"
          }
        }
      };
      let action = new Action(params);
      let parsed = action.parseUses();
      expect(action.entrypoint).toBe("--entrypoint echo");
      expect(action.args).toBe("hello");
      expect(action.repo).toBe("wflow-ubuntu-latest");
      expect(action.version).toBe(undefined);
      expect(action.org).toBe("phishy");
      expect(action.name).toBe("phishy/wflow-ubuntu-latest");
    });
    fit("actions/checkout", () => {
      execa.command = jest.fn();
      let run = {
        ip: "127.0.0.1",
        event: {
          repository: {
            ssh_url: 'https://yo',
            clone_url: 'git@yo.com'
          }
        }
      };
      let job = {
        path: {
          run: "/tmp/a1b2c3",
          workspace: "/tmp/a1b2c3/workspace",
          action: "/tmp/a1b2c3/actions"
        }
      };
      let step = {
          uses: "actions/checkout",
          workspace: "/tmp",
          syslog: {
            port: "1234"
          }
        }
      let action = new Action({ run, job, step });
      let parsed = action.parseUses();
      expect(action.repo).toBe("checkout");
      expect(action.version).toBe(undefined);
      expect(action.org).toBe("actions");
      expect(action.name).toBe("actions/checkout");
    });
  });
});
