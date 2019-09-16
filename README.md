# Workflow

*Do things locally.*


## Requirements

* Docker
* Node.js

## Install

The following installs dependencies in `node_modules` and links `wflow` to work globally.

`./install.sh`

## Usage

Point wflow at a valid yaml file. You may also specify an event (a GitHub webhook payload). If you do not provide an event, it attempts to read from .git.

`wflow --file build.yml --event event.json`