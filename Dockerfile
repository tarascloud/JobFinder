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
# Install pdf-parse v1 in runner (v2 needs canvas/DOMMatrix)
RUN npm install pdf-parse@1.1.1 --no-save 2>/dev/null || true
# Install system Chromium for Playwright-based auto-apply
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN mkdir -p /app/data/resumes /app/data/screenshots /app/public/resumes /app/public/screenshots && chown -R nextjs:nodejs /app/data /app/public/resumes /app/public/screenshots
USER nextjs
EXPOSE 3456
ENV PORT=3456
CMD ["node", "server.js"]
