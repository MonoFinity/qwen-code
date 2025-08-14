# Stage 1: Build the application
FROM docker.io/library/node:20-slim AS builder


WORKDIR /app


COPY package.json package-lock.json ./
COPY packages ./packages
COPY scripts ./scripts
COPY esbuild.config.js ./esbuild.config.js
COPY README.md ./README.md
COPY .npmrc ./
COPY tsconfig.json ./tsconfig.json
COPY .prettierrc.json ./
COPY .editorconfig ./
COPY .gitignore ./
COPY .dockerignore ./
COPY Makefile ./Makefile
COPY QWEN.md ./QWEN.md
RUN npm install
RUN npm run bundle

# Stage 2: Create the production image
FROM docker.io/library/node:20-slim

ARG SANDBOX_NAME="qwen-code-sandbox"
ARG CLI_VERSION_ARG
ENV SANDBOX="$SANDBOX_NAME"
ENV CLI_VERSION=$CLI_VERSION_ARG

# install minimal set of packages, then clean up
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  man-db \
  curl \
  dnsutils \
  less \
  jq \
  bc \
  gh \
  git \
  unzip \
  rsync \
  ripgrep \
  procps \
  psmisc \
  lsof \
  socat \
  ca-certificates \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# set up npm global package folder under /usr/local/share
# give it to non-root user node, already set up in base image
RUN mkdir -p /usr/local/share/npm-global \
  && chown -R node:node /usr/local/share/npm-global
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# switch to non-root user node
USER node

WORKDIR /home/node/app


# Only copy built output and production files to final image
COPY --from=builder /app/bundle /home/node/app/bundle
COPY --from=builder /app/package.json /home/node/app/package.json
COPY --from=builder /app/README.md /home/node/app/README.md
COPY --from=builder /app/QWEN.md /home/node/app/QWEN.md
COPY --from=builder /app/Makefile /home/node/app/Makefile
COPY --from=builder /app/.npmrc /home/node/app/.npmrc
COPY --from=builder /app/.prettierrc.json /home/node/app/.prettierrc.json
COPY --from=builder /app/.editorconfig /home/node/app/.editorconfig
COPY --from=builder /app/.gitignore /home/node/app/.gitignore
COPY --from=builder /app/.dockerignore /home/node/app/.dockerignore

# Install production dependencies for externalized modules
RUN npm install --omit=dev \
  && npm rebuild

# Set default entrypoint to qwen CLI
CMD ["node", "bundle/qwen.mjs"]
