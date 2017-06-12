FROM node:latest

MAINTAINER Antonis Mygiakis <am@clmsuk.com>

# Install app dependencies
COPY package.json npm-shrinkwrap.json /usr/src/ci-gateway/

WORKDIR /usr/src/ci-gateway

# we also run npm cache clean to remove the tar files that npm downloads during the install;
# they won’t help if we rebuild the image, so they just take up space
RUN npm install && npm cache clean

# Bundle app source
COPY . /usr/src/ci-gateway

CMD ["node", "."]
