FROM node:22-bookworm-slim

# openssl: Prisma schema engine (migrate deploy) needs it
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .

# NEXT_PUBLIC_* are inlined into the browser bundle at build time, so they must be
# present here, not only at runtime. docker-compose passes them from .env.
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_AUTH_BASE_URL
ARG NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER
ARG NEXT_PUBLIC_WINDY_MAP_KEY
ARG R2_PUBLIC_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_AUTH_BASE_URL=$NEXT_PUBLIC_AUTH_BASE_URL \
    NEXT_PUBLIC_PUSHER_KEY=$NEXT_PUBLIC_PUSHER_KEY \
    NEXT_PUBLIC_PUSHER_CLUSTER=$NEXT_PUBLIC_PUSHER_CLUSTER \
    NEXT_PUBLIC_WINDY_MAP_KEY=$NEXT_PUBLIC_WINDY_MAP_KEY \
    R2_PUBLIC_URL=$R2_PUBLIC_URL

# Build never talks to the real DB; a localhost URL keeps lib/prisma.ts from
# starting its keep-warm pool against production during page collection.
RUN DATABASE_URL=postgresql://build@localhost:5432/build pnpm build

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.js && pnpm start"]
