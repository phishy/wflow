const checkout = require("./index");

var execa = require("execa");
jest.mock("execa");

describe("checkout", () => {
  it("clone a repository", async done => {
    execa.command = jest.fn();

    let inputs = {
      repository: "git@github.com:phishy/wflow.git",
      path: "/tmp/wflow"
    };
    let res = await checkout({ inputs });
    let expected = [
      "git clone git@github.com:phishy/wflow.git /tmp/wflow",
      { shell: true }
    ];
    expect(res).toBe(true);
    expect(execa.command.mock.calls[0]).toEqual(expected);
    done();
  });
  it('should throw exception when missing repository', async done => {
    let inputs = {
    };
    await expect(checkout({ inputs })).rejects.toThrow(
      "Checkout plugin requires inputs.repository"
    );
    done();
  });
  it("should throw exception when missing path", async done => {
    let inputs = {
      repository: "git@github.com:phishy/wflow.git"
    };
    await expect(checkout({ inputs })).rejects.toThrow(
      "Checkout plugin requires inputs.path"
    );
    done();
  });
});
