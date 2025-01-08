FROM oven/bun:alpine AS builder

# Add build arguments
ARG BUILD_VAR
ENV BUILD_VAR=$BUILD_VAR

WORKDIR /app

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN bun install

# Build if needed (uncomment if you have a build step)
# RUN bun run build

# Production image
FROM oven/bun:alpine

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY ./runner ./runner
COPY ./src ./src
COPY ./package.json ./

# Set user for security
USER bun

# Command to run the app with force kill signal handling
CMD ["bun", "runner/index.ts"] 