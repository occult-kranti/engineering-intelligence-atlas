# syntax=docker/dockerfile:1
# Build deploy/Dockerfile as daftar-runtime:local first. No engine/license is
# embedded in this image; verified owner-managed engines are mounted read-only.
ARG BASE_RUNTIME_IMAGE=daftar-runtime:local
FROM ${BASE_RUNTIME_IMAGE}
USER root
COPY deploy/creative/install.py deploy/creative/profiles.json deploy/creative/tools.lock.json /opt/daftar-creative-installer/
RUN apt-get update \
    && apt-get install --yes --no-install-recommends python3 ca-certificates \
    && python3 /opt/daftar-creative-installer/install.py --install --tool graphics --profile open-graphics --prefix /usr/share/daftar-creative \
    && rm -rf /var/lib/apt/lists/* \
    && install -d -o 10001 -g 10001 -m 0700 /var/lib/daftar-creative
USER 10001:10001
