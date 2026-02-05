# Sales Boost Bot - Railway deployment
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Prisma
COPY prisma ./prisma/
RUN npx prisma generate

# Build
COPY tsconfig.json ./
COPY src ./src/
COPY public ./public/
COPY data ./data/
RUN npm run build

# Production
ENV NODE_ENV=production
EXPOSE 3000

# Migrate and start (migrations run on each deploy)
CMD npx prisma migrate deploy && node dist/index.js
