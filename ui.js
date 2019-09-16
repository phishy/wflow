const express = require("express");
const logger = require("signale");
const history = require("connect-history-api-fallback");

const app = express();
const port = 3001;

app.use(
  history({
    verbose: false
  })
);
app.use(express.static("ui/build"));

module.exports = {
  start: () =>
    new Promise((resolve, reject) => {
      app.listen(port, () => {
        logger.start(`Workflow UI listening on port ${port}!`);
        resolve();
      });
    })
};
