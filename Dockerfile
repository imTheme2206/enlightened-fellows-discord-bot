FROM node:20-alpine

# Needed for Git dependency in package.json
RUN apk add --no-cache git

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@latest --activate \
 && pnpm install --frozen-lockfile

# Copy source (including assets)
COPY . .

# Build TypeScript -> dist
RUN pnpm build

# Run the bot
CMD ["node", "dist/index.js"]
