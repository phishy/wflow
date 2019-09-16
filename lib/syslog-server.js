"use strict";

const dgram = require("dgram");
const EventEmitter = require("events");

let server;
let status = false;

class SyslogServer extends EventEmitter {
  constructor() {
    super();
  }

  start(options = { port: 514, address: "0.0.0.0", exclusive: true }, cb) {
    return new Promise((resolve, reject) => {
      server = dgram.createSocket("udp4");

      // Socket listening handler
      server.on("listening", () => {
        status = true;
        this.emit("start");
      });

      // Socket error handler
      server.on("error", err => {
        this.emit("error", err);
      });

      // Socket message handler
      server.on("message", (msg, remote) => {
        let message = {
          date: new Date(),
          host: remote.address,
          message: msg.toString("utf8"),
          protocol: remote.family
        };
        this.emit("message", message);
      });

      // Socket close handler
      server.on("close", () => {
        status = false;
        this.emit("stop");
      });

      server.bind(options, err => {
        if (err) {
          let errorObj = createErrorObject(
            err,
            "NodeJS Syslog Server failed to start!"
          );
          if (cb) return cb(errorObj);
          return reject(errorObj);
        } else {
          if (cb) return cb();
          return resolve();
        }
      });
    });
  }

  stop(cb) {
    return new Promise((resolve, reject) => {
      try {
        server.close(() => {
          if (cb) return cb();
          return resolve();
        });
      } catch (err) {
        let errorObj = createErrorObject(
          err,
          "NodeJS Syslog Server is not running!"
        );
        if (cb) return cb(errorObj);
        return reject(errorObj);
      }
    });
  }

  isRunning() {
    return status;
  }
}

function createErrorObject(err, message) {
  return {
    date: new Date(),
    error: err,
    message: message
  };
}

module.exports = SyslogServer;
