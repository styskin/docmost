#!/bin/bash

DATE=`date +%Y%m%d`
docker buildx build --platform linux/amd64 -t docker.io/styskin/manulai:${DATE} -t docker.io/styskin/manulai:latest --push .
