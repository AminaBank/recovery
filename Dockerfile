FROM node:20-bullseye AS base

ARG UID=1000
ARG GID=1000

ENV DEBIAN_FRONTEND=noninteractive

# Install required packages
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      python3 \
      git \
      ca-certificates \
      fakeroot \
      libgtk-3-0 \
      libnss3 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libatspi2.0-0 \
      libcups2 \
      libdrm2 \
      libgbm1 \
      libasound2 \
      libxshmfence1 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libxkbcommon0 \
      libpango-1.0-0 \
      libcairo2 \
      libxss1 \
    && rm -rf /var/lib/apt/lists/*

ARG UID=1000
ARG GID=1000
RUN mkdir -p /workspace /home/node/.cache \
    && chown -R "$UID:$GID" /workspace /home/node

WORKDIR /workspace
USER node

FROM base AS deps

# Copy manifest files
COPY --chown=node:node package.json yarn.lock .npmrc ./
COPY --chown=node:node apps/recovery-utility/package.json  apps/recovery-utility/
COPY --chown=node:node apps/recovery-relay/package.json    apps/recovery-relay/
COPY --chown=node:node packages/asset-config/package.json          packages/asset-config/
COPY --chown=node:node packages/e2e-tests/package.json             packages/e2e-tests/
COPY --chown=node:node packages/eslint-config-custom/package.json  packages/eslint-config-custom/
COPY --chown=node:node packages/extended-key-recovery/package.json packages/extended-key-recovery/
COPY --chown=node:node packages/shared/package.json                packages/shared/
COPY --chown=node:node packages/tsconfig/package.json              packages/tsconfig/
COPY --chown=node:node packages/wallet-derivation/package.json     packages/wallet-derivation/

# Create script folder
COPY --chown=node:node scripts/ scripts/
RUN HUSKY=0 yarn install --frozen-lockfile --network-timeout 600000

FROM deps AS app
COPY --chown=node:node . .

CMD ["bash"]
