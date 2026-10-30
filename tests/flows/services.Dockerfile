# Every container image a real service in the flow suite runs, one per
# stage, pinned. Never built: tests/flows/harness/images.ts and
# scripts/flows/run.ts read the pins, CI caches the images, and Dependabot bumps
# them (.github/dependabot.yml). The stage name is the image's key.

# A tiny HTTP server for the container harness's own spec
FROM busybox:1.37 AS busybox

# An SSO provider (helpers/sso/authelia.ts)
FROM authelia/authelia:4.39.28 AS authelia

# A reverse proxy (helpers/proxy/traefik.ts)
FROM traefik:v3.7.16 AS traefik

# SWAG's nginx and shipped proxy include (helpers/proxy/swag.ts)
FROM lscr.io/linuxserver/swag:5.8.0-ls494 AS swag

# Nginx Proxy Manager, configured through its API (helpers/proxy/nginxProxyManager.ts)
FROM jc21/nginx-proxy-manager:2.16.0 AS nginxProxyManager
