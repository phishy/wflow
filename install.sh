#!/bin/bash

npm i
npm link
(cd ui; yarn; yarn build)
