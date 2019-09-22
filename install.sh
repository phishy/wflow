#!/bin/bash

npm i
npm link
(cd cli; npx yarn)
(cd ui; npx yarn; npx yarn build)
