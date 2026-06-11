FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3456

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install Docker CLI for launching containers from setup wizard
RUN apk add --no-cache docker-cli docker-cli-compose postgresql16-client

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p /data && chown nextjs:nodejs /data

# Run as root so we can access Docker socket
# (the setup wizard is a short-lived container)
EXPOSE 3456
CMD ["node", "server.js"]
