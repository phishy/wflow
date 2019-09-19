#!/bin/bash

npm i
(cd cli; npx yarn; npm link)
(cd ui; npx yarn; npx yarn build)
