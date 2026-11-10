FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# Data dir owned by the unprivileged "node" user (uid/gid 1000) so a fresh
# named volume is writable; bind mounts must be chown'ed 1000:1000 on the host.
RUN mkdir -p /app/data && chown node:node /app/data
USER node

CMD ["node", "src/index.js"]
