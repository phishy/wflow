FROM phishy/wflow-ubuntu-latest

ADD . /home/runner

WORKDIR /home/runner
RUN (cd cli; npm link)

RUN mkdir /root/.ssh
RUN ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts

ENTRYPOINT ["node", "/home/runner/runner.js"]


