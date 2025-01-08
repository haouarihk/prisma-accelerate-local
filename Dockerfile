FROM --platform=$BUILDPLATFORM oven/bun:alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./

# Install dependencies with platform-specific settings
RUN if [ "$(uname -m)" = "aarch64" ]; then \
        apk add --no-cache libc6-compat; \
    fi && \
    bun install

# Production image
FROM --platform=$TARGETPLATFORM oven/bun:alpine

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY ./runner ./runner
COPY ./src ./src
COPY ./package.json ./

# Set user for security
USER bun

# Command to run the app
CMD ["bun", "runner/index.ts"] 