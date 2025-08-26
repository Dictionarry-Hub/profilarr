# Dockerfile
FROM python:3.9-slim
WORKDIR /app
# Install git, gosu, and PowerShell Core
RUN apt-get update && apt-get install -y \
    git \
    gosu \
    wget \
    ca-certificates \
    libicu-dev \
    && wget -O /tmp/powershell.tar.gz https://github.com/PowerShell/PowerShell/releases/download/v7.4.0/powershell-7.4.0-linux-x64.tar.gz \
    && mkdir -p /opt/microsoft/powershell/7 \
    && tar zxf /tmp/powershell.tar.gz -C /opt/microsoft/powershell/7 \
    && chmod +x /opt/microsoft/powershell/7/pwsh \
    && ln -s /opt/microsoft/powershell/7/pwsh /usr/bin/pwsh \
    && rm /tmp/powershell.tar.gz \
    && rm -rf /var/lib/apt/lists/*
# Copy pre-built files from dist directory
COPY dist/backend/app ./app
COPY dist/backend/scripts ./app/scripts
COPY dist/static ./app/static
COPY dist/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Ensure scripts are executable
RUN chmod +x /app/scripts/*.ps1 || true
# Copy and setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
LABEL org.opencontainers.image.authors="Dictionarry dictionarry@pm.me"
LABEL org.opencontainers.image.description="Profilarr - Profile manager for *arr apps"
LABEL org.opencontainers.image.source="https://github.com/Dictionarry-Hub/profilarr"
LABEL org.opencontainers.image.title="Profilarr"
LABEL org.opencontainers.image.version="beta"
EXPOSE 6868
ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:6868", "--timeout", "600", "app.main:create_app()"]