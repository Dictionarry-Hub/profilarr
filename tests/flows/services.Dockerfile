# Every container image a real service in the flow suite runs, one per
# stage, pinned. Never built: tests/flows/harness/images.ts and
# scripts/flows.ts read the pins, CI caches the images, and Dependabot bumps
# them (.github/dependabot.yml). The stage name is the image's key.

# A tiny HTTP server for the container harness's own spec
FROM busybox:1.37 AS busybox
