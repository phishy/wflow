const runJob = require("./job");

const mkdir = require("./mkdir");
const execa = require("execa");
jest.mock('execa');
jest.mock('./mkdir');

describe("job", () => {
  it("should do things", async (done) => {

    mkdir.mockResolvedValue('/tmp');

    let event = {
      repository: {
        ssh_url: 'http://'
      }
    };

    let secrets = {
      NPM_TOKEN: 'a',
      GITHUB_TOKEN: 'a'
    };

    let job = {
      name: "Build API Container",
      "runs-on": "ubuntu-latest",
      steps: [
        { uses: "actions/checkout@v1" },
        {
          name: "Install",
          env: {
            NPM_TOKEN: "${{ secrets.NPM_TOKEN }}",
            AUTH_GITHUB_TOKEN: "${{ secrets.AUTH_GITHUB_TOKEN }}",
            GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
            AWS_ACCESS_KEY_ID: "${{ secrets.AWS_ACCESS_KEY_ID }}",
            AWS_SECRET_ACCESS_KEY: "${{ secrets.AWS_SECRET_ACCESS_KEY }}"
          },
          run: "./build.sh"
        }
      ]
    };
    let res = await runJob(event, secrets, job);
    expect(execa.mock.calls[0]).toBe(4);
    done();
  });
});
