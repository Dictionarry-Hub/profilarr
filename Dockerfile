# =============================================================================
# Profilarr Dockerfile
# =============================================================================
# Multi-stage build for minimal final image size
#
# Build:  docker build -t profilarr .
# Run:    docker run -v ./config:/config -p 6868:6868 profilarr

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM denoland/deno:2.5.6 AS builder

WORKDIR /build

# Copy dependency files first (cache key)
COPY deno.json deno.lock* ./

# Copy everything else
COPY . .

# Install dependencies (needs full source to resolve npm: imports)
RUN deno install --node-modules-dir

# Build the application
# 1. Vite builds SvelteKit to dist/build/
# 2. Deno compiles to standalone binary

# Build-time variables for version card
# TARGETARCH is automatically set by Docker buildx (amd64 or arm64)
ARG TARGETARCH
ARG VITE_CHANNEL=stable
ENV VITE_PLATFORM=docker-${TARGETARCH}
ENV VITE_CHANNEL=${VITE_CHANNEL}

ENV APP_BASE_PATH=/build/dist/build
RUN deno run -A npm:vite build
RUN DENO_TARGET=$(case "${TARGETARCH}" in \
        arm64) echo "aarch64-unknown-linux-gnu" ;; \
        *)     echo "x86_64-unknown-linux-gnu" ;; \
    esac) && \
    deno compile \
    --no-check \
    --allow-net \
    --allow-read \
    --allow-write \
    --allow-env \
    --allow-ffi \
    --allow-run \
    --allow-sys \
    --target "$DENO_TARGET" \
    --output dist/build/profilarr \
    dist/build/mod.ts

# -----------------------------------------------------------------------------
# Stage 2: Runtime
# -----------------------------------------------------------------------------
FROM debian:12-slim

# Labels for container metadata
LABEL org.opencontainers.image.title="Profilarr"
LABEL org.opencontainers.image.description="Configuration management for Radarr and Sonarr"
LABEL org.opencontainers.image.source="https://github.com/Dictionarry-Hub/profilarr"
LABEL org.opencontainers.image.licenses="AGPL-3.0"

# Install runtime dependencies
# - git: PCD repository operations (clone, pull, push)
# - tar: Backup creation and restoration
# - curl: Health checks
# - gosu: Drop privileges to non-root user
# - ca-certificates: HTTPS connections
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    tar \
    curl \
    gosu \
    ca-certificates \
    libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create application directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /build/dist/build/profilarr /app/profilarr
COPY --from=builder /build/dist/build/server.js /app/server.js
COPY --from=builder /build/dist/build/static /app/static

# Copy entrypoint script
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create config directory
RUN mkdir -p /config

# Environment variables
ENV PORT=6868
ENV HOST=0.0.0.0
ENV APP_BASE_PATH=/config
ENV TZ=UTC
# DENO_SQLITE_PATH is set in entrypoint.sh based on architecture

# Expose port
EXPOSE 6868

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:${PORT}/api/v1/health || exit 1

# Volume for persistent data
VOLUME /config

# Entrypoint handles PUID/PGID/UMASK then runs the app
# Starts as root for chown/useradd, drops to PUID via gosu before exec
# nosemgrep: dockerfile.security.missing-user-entrypoint.missing-user-entrypoint
ENTRYPOINT ["/entrypoint.sh"]