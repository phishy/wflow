FROM ubuntu:latest

ARG DEBIAN_FRONTEND=noninteractive
ENV USER root

RUN apt-get update

RUN apt-get install -y \
  ansible \
  awscli \
  build-essential \
  curl \
  dnsutils \
  docker \
  ftp \
  git \
  jq \
  mercurial \
  netcat \
  p7zip \
  rsync \
  shellcheck \
  sudo \
  telnet \
  unzip \
  zip

# Node 10.x
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install -y nodejs
RUN npm i -g bower yarn grunt parcel-bundler n webpack webpack-cli

# docker-compose
RUN curl -L "https://github.com/docker/compose/releases/download/1.24.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
RUN chmod +x /usr/local/bin/docker-compose
