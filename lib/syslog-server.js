"use strict";

const dgram = require("dgram");
const EventEmitter = require("events");

class SyslogServer extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.status = false;
  }

  start(options = { port: 514, address: "0.0.0.0", exclusive: true }, cb) {
    return new Promise((resolve, reject) => {
      if (this.status === true) {
        let errorObj = createErrorObject(
          null,
          "NodeJS Syslog Server is already running!"
        );
        if (cb) return cb(errorObj);
        return reject(errorObj);
      } else {
        this.server = dgram.createSocket("udp4");

        // Socket listening handler
        this.server.on("listening", () => {
          this.status = true;
          this.emit("start");
        });

        // Socket error handler
        this.server.on("error", err => {
          this.emit("error", err);
        });

        // Socket message handler
        this.server.on("message", (msg, remote) => {
          let message = {
            date: new Date(),
            host: remote.address,
            message: msg.toString("utf8"),
            protocol: remote.family
          };
          this.emit("message", message);
        });

        // Socket close handler
        this.server.on("close", () => {
          this.status = false;
          this.emit("stop");
        });

        this.server.bind(options, err => {
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
      }
    });
  }

  stop(cb) {
    return new Promise((resolve, reject) => {
      try {
        this.server.close(() => {
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
    return this.status;
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
