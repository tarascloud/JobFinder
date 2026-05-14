FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate
RUN rm -rf .next node_modules/.cache && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# JF-MIG-01: Copy prisma CLI + engine + migrations for runtime migrate deploy
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# Install pdf-parse v1 in runner (v2 needs canvas/DOMMatrix)
RUN npm install pdf-parse@1.1.1 --no-save 2>/dev/null || true
# Install system Chromium for Playwright-based auto-apply
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN mkdir -p /app/data/resumes /app/data/screenshots /app/public/resumes /app/public/screenshots && chown -R nextjs:nodejs /app/data /app/public/resumes /app/public/screenshots
# JF-MIG-01: entrypoint runs prisma migrate deploy before starting Next.js
COPY scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && chown nextjs:nodejs /app/entrypoint.sh
USER nextjs
EXPOSE 3456
ENV PORT=3456
# DEV-20260507-0019: Add HEALTHCHECK — wget-based (wget available in alpine)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3456/api/health > /dev/null || exit 1
ENTRYPOINT ["/app/entrypoint.sh"]
