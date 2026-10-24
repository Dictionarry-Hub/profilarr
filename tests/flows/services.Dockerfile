# Every container image a real service in the flow suite runs, one per
# stage, pinned. Never built: tests/flows/harness/images.ts and
# scripts/flows.ts read the pins, CI caches the images, and Dependabot bumps
# them (.github/dependabot.yml). The stage name is the image's key.

# A tiny HTTP server for the container harness's own spec
FROM busybox:1.37 AS busybox

# An SSO provider (helpers/auth/sso/authelia.ts)
FROM authelia/authelia:4.39.28 AS authelia

# A reverse proxy (helpers/proxy/traefik.ts)
FROM traefik:v3.7.16 AS traefik
