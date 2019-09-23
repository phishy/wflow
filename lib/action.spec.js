const Action = require("./action");

describe("action", () => {
  describe("parseUses", () => {
    it("should parse docker uses correctly", () => {
      let params = {
        run: {
          ip: '127.0.0.1'
        },
        env: {

        },
        step: {
          uses: "docker://phishy/wflow-ubuntu-latest",
          with: {
            entrypoint: "echo",
            args: "hello"
          },
          workspace: '/tmp',
          syslog: {
            port: '1234'
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
      // let rendered = action.render();
      // expect(rendered).toBe(4);
    });
    it("should parse docker actions uses correctly", () => {
      let params = {
        run: {
          ip: "127.0.0.1",
          path: {
            run: '/tmp/a1b2c3',
            workspace: '/tmp/a1b2c3/workspace',
            action: '/tmp/a1b2c3/actions'
          }
        },
        env: {},
        step: {
          uses: "actions/checkout",
          workspace: "/tmp",
          syslog: {
            port: "1234"
          }
        }
      };
      let action = new Action(params);
      let parsed = action.parseUses();
      expect(action.repo).toBe("checkout");
      expect(action.version).toBe(undefined);
      expect(action.org).toBe("actions");
      expect(action.name).toBe("actions/checkout");
    });
  });
});
