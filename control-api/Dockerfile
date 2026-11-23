# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

# Stage 2: Runtime
FROM node:22-alpine AS runner
WORKDIR /app

USER node

COPY --chown=node:node --from=builder /app/package.json ./
COPY --chown=node:node --from=builder /app/node_modules/ ./node_modules/
COPY --chown=node:node --from=builder /app/dist/ ./dist/

ENV NODE_ENV=production \
    PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/healthz || exit 1

CMD ["node", "dist/index.js"]
