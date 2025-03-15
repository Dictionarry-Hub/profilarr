# Dockerfile
FROM python:3.9-slim
WORKDIR /app
# Install git (since we're still using slim)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
# Copy pre-built files from dist directory
COPY dist/backend/app ./app
COPY dist/static ./app/static
COPY dist/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
LABEL org.opencontainers.image.authors="Dictionarry dictionarry@pm.me"
LABEL org.opencontainers.image.description="Profilarr - Profile manager for *arr apps"
LABEL org.opencontainers.image.source="https://github.com/Dictionarry-Hub/profilarr"
LABEL org.opencontainers.image.title="Profilarr"
LABEL org.opencontainers.image.version="beta"
EXPOSE 6868
CMD ["gunicorn", "--bind", "0.0.0.0:6868", "--timeout", "600", "app.main:create_app()"]