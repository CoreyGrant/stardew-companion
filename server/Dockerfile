FROM oven/bun:1

WORKDIR /app

COPY package.json ./
RUN bun install --frozen-lockfile

COPY src ./src

ENV DATABASE_PATH=/data/sync.db
ENV PORT=3000

CMD ["bun", "run", "src/index.ts"]
