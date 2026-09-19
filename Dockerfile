# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@12.4.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm catalog:validate && pnpm typecheck && pnpm test && pnpm build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/training.sqlite \
    LOCAL_MEDIA_PATH=/app/files
RUN groupadd --system training && useradd --system --gid training --home-dir /app training \
    && mkdir -p /app/data /app/files \
    && chown -R training:training /app
COPY --from=build --chown=training:training /app/.output ./.output
COPY --from=build --chown=training:training /app/drizzle ./drizzle
COPY --from=build --chown=training:training /app/seed ./seed
COPY --from=build --chown=training:training ["/app/Desencadenado-Entrenos con peso corporal/files", "./files"]
USER training
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
