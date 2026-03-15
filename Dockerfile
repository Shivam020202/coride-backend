# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install ALL deps (including devDeps for tsc)
COPY package*.json ./
RUN npm install

# Copy source and compile TypeScript → dist/
COPY . .
RUN npm run build

# ── Stage 2: Production image ────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Only install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Expose the port Express listens on
EXPOSE 5000

# Start the compiled server
CMD ["node", "dist/index.js"]
