# Stage 1: Build the React client
FROM node:20-slim AS client-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Run the Bun server (serves API + built client)
FROM oven/bun:1
WORKDIR /app
COPY server/package.json server/bun.lock ./
RUN bun install --frozen-lockfile
COPY server/src ./src
COPY --from=client-builder /app/dist ./public
ENV DATABASE_PATH=/data/sync.db
ENV PORT=3000
CMD ["bun", "run", "src/index.ts"]
