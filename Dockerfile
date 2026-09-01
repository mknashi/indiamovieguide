# syntax=docker/dockerfile:1

# better-sqlite3 is a native module: it must be compiled against the same
# libc and Node ABI it will run on, so both stages share one base image.
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines import.meta.env.* at build time, so these must be present now --
# supplying them at runtime leaves analytics dead and the captcha widget
# rendering "Captcha not configured". Both are public values (a GA measurement
# id and a reCAPTCHA *site* key), so baking them into the bundle is expected.
ARG VITE_GA_MEASUREMENT_ID=""
ARG VITE_RECAPTCHA_SITEKEY=""
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID \
    VITE_RECAPTCHA_SITEKEY=$VITE_RECAPTCHA_SITEKEY

RUN npm run build

# Drop dev dependencies but keep the compiled better-sqlite3 binary that
# `npm ci` just produced, so the runtime stage needs no toolchain at all.
RUN npm prune --omit=dev


FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8787

# The image ships a `node` user; running as root would leave the SQLite file
# on the volume owned by root and awkward to back up.
RUN mkdir -p /data && chown -R node:node /data

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node agent ./agent
COPY --chown=node:node package.json ./

USER node
EXPOSE 8787

# Compose owns the real healthcheck; this one keeps `docker run` honest.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
