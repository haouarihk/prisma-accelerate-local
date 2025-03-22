# prisma-accelerate-local

This is a fork of [prisma-accelerate-local](https://github.com/node-libraries/prisma-accelerate-local) that provides self-hosted Prisma Accelerate functionality for local development and production environments.

## Overview

This package allows you to run Prisma Accelerate locally, providing connection pooling and query caching capabilities without relying on Prisma's cloud service.

## Added Features

- **Docker Support**: Ready-to-use Docker configuration for easy integration with docker-compose
- **Performance Improvements**: Optional Elysia.js and Bun.js runtime instead of Fastify and Node.js (enable with `USE_ELYSIA=1` environment variable)
- **Simple Configuration**: Easy setup with minimal environment variables

## Requirements

- Node.js 18+ or Bun.js
- a database supported
- Docker (optional, for containerized deployment)

# Usage:

```yaml
version: '3'
services:
  webtest:
    image: hello-world
    environment:
      - DATA_PROXY_URL=prisma://accelerate:4000/?api_key=123123
    depends_on:
      - accelerate
  accelerate:
      image: ghcr.io/haouarihk/prisma-accelerate-local:latest
      restart: unless-stopped
      stop_signal: SIGKILL
      network_mode: host
      environment:
        - PORT=4000
        - HOST=0.0.0.0
        - USE_ELYSIA=1
        - PRISMA_TRACE_ENGINE_CLIENT=0
        - PRISMA_TELEMETRY_INFORMATION_DISABLED=1
        - DATA_PROXY_API_KEY=123123
        - DATABASE_URL=${DATABASE_URL} # YOUR DATABASE CONNECTION STRING
```

## Notes:
- make sure that DATA_PROXY_API_KEY and DATA_PROXY_URL match the api_key