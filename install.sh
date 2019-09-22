#!/bin/bash

npm i
sudo npm link
(cd cli; npx yarn)
(cd ui; npx yarn; npx yarn build)
