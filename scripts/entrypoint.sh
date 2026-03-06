#!/bin/bash
# =============================================================================
# Profilarr Container Entrypoint
# =============================================================================
# Handles PUID/PGID/UMASK setup for proper file permissions
set -e

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
# Set architecture-dependent SQLite path
# -----------------------------------------------------------------------------
ARCH=$(uname -m)
export DENO_SQLITE_PATH="/usr/lib/${ARCH}-linux-gnu/libsqlite3.so.0"

# -----------------------------------------------------------------------------
# Drop privileges and run
# -----------------------------------------------------------------------------
exec gosu "${APP_USER}" /app/profilarr