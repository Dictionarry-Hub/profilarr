#!/bin/bash
set -e

# Default to UID/GID 1000 if not provided
PUID=${PUID:-1000}
PGID=${PGID:-1000}
# Default umask to 022 if not provided
UMASK=${UMASK:-022}

echo "Starting with UID: $PUID, GID: $PGID, UMASK: $UMASK"

# Set umask
umask "$UMASK"

# Create group with specified GID
groupadd -g "$PGID" appgroup 2>/dev/null || true

# Create user with specified UID and GID
useradd -u "$PUID" -g "$PGID" -d /home/appuser -s /bin/bash appuser 2>/dev/null || true

# Create home directory if it doesn't exist
mkdir -p /home/appuser
chown "$PUID:$PGID" /home/appuser

# Fix permissions on /config if it exists
if [ -d "/config" ]; then
    echo "Setting up /config directory permissions"
    # Change ownership of /config and all its contents to PUID:PGID
    # This ensures files created by different UIDs are accessible
    chown -R "$PUID:$PGID" /config
fi

# Execute the main command as the specified user with umask
echo "Starting application as user $PUID:$PGID with umask $UMASK"
exec gosu "$PUID:$PGID" /bin/bash -c "umask $UMASK && exec $(printf '%q ' "$@")"