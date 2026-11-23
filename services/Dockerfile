# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src/ ./src/
RUN npm run build && npm prune --production

# Stage 2: Runtime
FROM node:22-alpine AS runner
WORKDIR /app

USER node

COPY --chown=node:node --from=builder /app/package.json ./
COPY --chown=node:node --from=builder /app/node_modules/ ./node_modules/
COPY --chown=node:node --from=builder /app/dist/ ./dist/

ARG RELEASE_LABEL=current
ARG EXTRA_LATENCY_MS=0
ARG ERROR_RATE=0

ENV NODE_ENV=production \
    PORT=8080 \
    ADMIN_PORT=9090 \
    RELEASE_LABEL=${RELEASE_LABEL} \
    EXTRA_LATENCY_MS=${EXTRA_LATENCY_MS} \
    ERROR_RATE=${ERROR_RATE}

EXPOSE 8080 9090

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:9090/healthz || exit 1

CMD ["node", "dist/index.js"]

