FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache git python3 make g++
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git python3 make g++
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/assets ./assets
EXPOSE 3000
CMD ["node", "dist/index.js"]
