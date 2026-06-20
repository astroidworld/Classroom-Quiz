# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy root configurations and workspace configurations
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install dependencies
RUN npm ci

# Copy source files
COPY shared/ ./shared/
COPY client/ ./client/
COPY server/ ./server/

# Build client and server
RUN npx prisma generate --schema=./server/prisma/schema.prisma
RUN npm run build:client
RUN npm run build:server

# Production runtime stage
FROM node:18-slim AS runner
WORKDIR /app

# Install OpenSSL (required by Prisma engine)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy prisma schema and client files
COPY --from=builder /app/server/prisma ./server/prisma

# Re-generate Prisma Client for production runtime platform
RUN npx prisma generate --schema=./server/prisma/schema.prisma

# Copy built server and public client assets
COPY --from=builder /app/shared/ ./shared/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Run the backend server, which will also serve client/dist
CMD ["npm", "run", "start", "--workspace=server"]