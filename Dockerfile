FROM oven/bun:alpine AS builder

WORKDIR /app

# Copy all package files first
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY runner/package.json ./runner/

# Install dependencies with platform-specific settings
RUN if [ "$(uname -m)" = "aarch64" ]; then \
        apk add --no-cache libc6-compat; \
    fi

# Install dependencies
RUN bun install 

# Install runner dependencies
RUN cd runner && bun install

# Production image
FROM oven/bun:alpine

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/runner/node_modules ./runner/node_modules
COPY ./runner ./runner
COPY ./src ./src
COPY ./package.json ./

# Set user for security
USER bun

# Command to run the app
CMD ["bun", "runner/index.ts"] 