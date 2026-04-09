#!/bin/bash

set -e

# =============================================================================
# Profilarr Container Entrypoint
# =============================================================================
# Two operational modes:
#
# 1. Root mode (default Docker):
#    Container starts as root. PUID/PGID/UMASK env vars control which user
#    the app ultimately runs as. Useful for NAS/home server deployments where
#    bind-mount ownership must match a specific host UID/GID.
#
# 2. Non-root mode (Kubernetes / hardened Docker):
#    Set runAsUser/runAsNonRoot in your pod securityContext (or --user in
#    docker run). The entrypoint detects it is not root, skips all privilege
#    operations, and execs the app directly. Volume ownership should be
#    handled externally (K8s fsGroup, init containers, or pre-provisioned
#    storage permissions).
# -----------------------------------------------------------------------------
# Set architecture-dependent SQLite path
# -----------------------------------------------------------------------------
ARCH=$(uname -m)
export DENO_SQLITE_PATH="/usr/lib/${ARCH}-linux-gnu/libsqlite3.so.0"

# -----------------------------------------------------------------------------
# Non-root fast path — skip all privilege operations
# -----------------------------------------------------------------------------
if [ "$(id -u)" != "0" ]; then
    umask "${UMASK:-022}"
    mkdir -p /config/data /config/logs /config/backups /config/databases
    exec /app/profilarr
fi

# Handles PUID/PGID/UMASK setup for proper file permissions
PUID=${PUID:-1000}
PGID=${PGID:-1000}
UMASK=${UMASK:-022}

# -----------------------------------------------------------------------------
# Resolve group - use existing GID or create/modify group
# -----------------------------------------------------------------------------
if getent group "${PGID}" > /dev/null 2>&1; then
    # GID already taken - use that group
    APP_GROUP=$(getent group "${PGID}" | cut -d: -f1)
elif ! getent group profilarr > /dev/null 2>&1; then
    # GID free, profilarr doesn't exist - create it
    groupadd -g "${PGID}" profilarr
    APP_GROUP=profilarr
else
    # GID free, but profilarr exists with wrong GID - modify it
    groupmod -g "${PGID}" profilarr 2>/dev/null || true
    APP_GROUP=profilarr
fi

# -----------------------------------------------------------------------------
# Resolve user - use existing UID or create/modify user
# -----------------------------------------------------------------------------
if getent passwd "${PUID}" > /dev/null 2>&1; then
    # UID already taken - use that user
    APP_USER=$(getent passwd "${PUID}" | cut -d: -f1)
    usermod -g "${APP_GROUP}" "${APP_USER}" 2>/dev/null || true
elif ! getent passwd profilarr > /dev/null 2>&1; then
    # UID free, profilarr doesn't exist - create it
    useradd -u "${PUID}" -g "${APP_GROUP}" -d /config -s /bin/bash profilarr
    APP_USER=profilarr
else
    # UID free, but profilarr exists with wrong UID - modify it
    usermod -u "${PUID}" -g "${APP_GROUP}" profilarr 2>/dev/null || true
    APP_USER=profilarr
fi

# -----------------------------------------------------------------------------
# Set umask
# -----------------------------------------------------------------------------
umask "${UMASK}"

# -----------------------------------------------------------------------------
# Create config directory structure
# -----------------------------------------------------------------------------
mkdir -p /config/data /config/logs /config/backups /config/databases

# -----------------------------------------------------------------------------
# Fix ownership of config directory
# -----------------------------------------------------------------------------
chown -R "${PUID}:${PGID}" /config

# -----------------------------------------------------------------------------
# Drop privileges and run
# -----------------------------------------------------------------------------
exec gosu "${APP_USER}" /app/profilarr
