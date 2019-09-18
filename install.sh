#!/bin/bash

npm i
(cd cli; yarn; yarn link)
(cd ui; yarn; yarn build)
