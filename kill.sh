#!/bin/bash

docker kill $(docker ps -q)
rm -rf workspaces/*
rm data/*.db
