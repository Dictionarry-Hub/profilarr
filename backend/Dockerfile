FROM python:3.9
WORKDIR /app
# Install PowerShell Core
RUN apt-get update && apt-get install -y \
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
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Ensure scripts are executable
RUN chmod +x /app/scripts/*.ps1 || true
# Use gunicorn with 10-minute timeout
CMD ["python", "-m", "app.main"]