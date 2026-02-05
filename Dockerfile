# Sales Boost Bot - Railway deployment
# Stage 1: Build
FROM node:20-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ALL dependencies (including dev for tsc)
COPY package.json package-lock.json ./
RUN npm ci

# Prisma
COPY prisma ./prisma/
RUN npx prisma generate

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src/
COPY public ./public/
COPY data ./data/
RUN npm run build

# Stage 2: Production
FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy built output from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data

ENV NODE_ENV=production
EXPOSE 3000

CMD npx prisma migrate deploy && node dist/index.js
