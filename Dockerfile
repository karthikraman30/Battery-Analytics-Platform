FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY server/package.json server/bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy server source code
COPY server/ .

# Expose port
EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["bun", "run", "src/index.ts"]
