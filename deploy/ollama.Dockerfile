# No model weights are part of this image. Choose an explicit reviewed image
# digest via DAFTAR_OLLAMA_IMAGE for a reproducible production deployment.
ARG OLLAMA_IMAGE=ollama/ollama:latest
FROM ${OLLAMA_IMAGE}
USER 0:0
RUN mkdir -p /var/lib/ollama \
    && chown 10001:10001 /var/lib/ollama \
    && chmod 0700 /var/lib/ollama
ENV HOME=/var/lib/ollama \
    OLLAMA_MODELS=/var/lib/ollama/models \
    OLLAMA_HOST=127.0.0.1:11434 \
    OLLAMA_NO_CLOUD=1
USER 10001:10001
