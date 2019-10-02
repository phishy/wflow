#!/bin/bash

docker build -f ./runners/ubuntu-latest/Dockerfile -t phishy/wflow-runner-ubuntu-latest .
docker push phishy/wflow-runner-ubuntu-latest
