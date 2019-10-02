#!/bin/bash

docker run -it --rm \
  -v $PWD:/home/runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /usr/local/bin/docker:/usr/bin/docker \
  -p 3000:3000 \
  -p 3001:3001 \
  phishy/wflow-runner-ubuntu-latest \
  bash
