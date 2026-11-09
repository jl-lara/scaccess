# syntax=docker/dockerfile:1

# Stage 1: install all workspace dependencies (including dev dependencies
# required to compile TypeScript and generate the Prisma client).
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma

RUN npm ci --include=dev

# Stage 2: compile @scaccess/shared and @scaccess/api, then drop dev
# dependencies so only production packages remain in node_modules.
FROM deps AS build
WORKDIR /app

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build
RUN npm prune --omit=dev

# Stage 3: minimal runtime image running as the unprivileged node user.
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --chown=node:node --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --chown=node:node --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --chown=node:node --from=build /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --chown=node:node --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]
