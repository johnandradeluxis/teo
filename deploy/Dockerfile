FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv tesseract-ocr tesseract-ocr-por tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/pdf && /opt/pdf/bin/pip install --no-cache-dir pymupdf==1.26.7
COPY --chown=node:node . /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 PYTHON_BIN=/opt/pdf/bin/python TEO_DATA_DIR=/app/data
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME /app/data
EXPOSE 3000
CMD ["node","server/index.mjs"]
