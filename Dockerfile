# Dockerfile
FROM python:3.9-slim
WORKDIR /app

# Copy pre-built files from dist directory
COPY dist/backend/* .
COPY dist/static ./app/static
COPY dist/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Add labels for Docker Hub
LABEL org.opencontainers.image.authors="Dictionarry dictionarry@pm.me"
LABEL org.opencontainers.image.description="Profilarr - Profile manager for *arr apps"
LABEL org.opencontainers.image.source="https://github.com/Dictionarry-Hub/profilarr"
LABEL org.opencontainers.image.title="Profilarr"
LABEL org.opencontainers.image.version="beta"

CMD ["gunicorn", "--bind", "0.0.0.0:6868", "app.main:create_app()"]