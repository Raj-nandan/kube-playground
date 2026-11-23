FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

USER node

COPY --chown=node:node .next/standalone ./
COPY --chown=node:node .next/static ./.next/static
COPY --chown=node:node public ./public

EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000 || exit 1

CMD ["node", "server.js"]
