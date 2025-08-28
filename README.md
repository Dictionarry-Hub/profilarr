# Profilarr

[![GitHub release](https://img.shields.io/github/v/release/Dictionarry-Hub/profilarr?color=blue)](https://github.com/Dictionarry-Hub/profilarr/releases)
[![Docker Pulls](https://img.shields.io/docker/pulls/santiagosayshey/profilarr?color=blue)](https://hub.docker.com/r/santiagosayshey/profilarr)
[![License](https://img.shields.io/github/license/Dictionarry-Hub/profilarr?color=blue)](https://github.com/Dictionarry-Hub/profilarr/blob/main/LICENSE)
[![Website](https://img.shields.io/badge/Website-dictionarry.dev-blue)](https://dictionarry.dev/)
[![Discord](https://img.shields.io/discord/1202375791556431892?color=blue&logo=discord&logoColor=white)](https://discord.com/invite/Y9TYP6jeYZ)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-blue?logo=buy-me-a-coffee)](https://www.buymeacoffee.com/santiagosayshey)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-Support-blue?logo=github-sponsors)](https://github.com/sponsors/Dictionarry-Hub)

Configuration management tool for Radarr/Sonarr that automates importing and version control of custom formats and quality profiles.

![Profilarr Preview](.github/images/preview.png)

## Features

-   🔄 Automatic synchronization with remote configuration databases
-   🎯 Direct import to Radarr/Sonarr instances
-   🔧 Git-based version control of your configurations
-   ⚡ Preserve local customizations during updates
-   🛠️ Built-in conflict resolution

## Getting Started

### Compatibility

| Architecture                   | Support      |
| ------------------------------ | ------------ |
| amd64 (x86_64)                 | ✅ Supported |
| arm64 (Apple Silicon, RPi 4/5) | ✅ Supported |

### Quick Installation (Docker Compose)

```yaml
services:
    profilarr:
        image: santiagosayshey/profilarr:latest # Use :beta for early access to new features
        container_name: profilarr
        ports:
            - 6868:6868
        volumes:
            - /path/to/your/data:/config # Replace with your actual path
        environment:
            - TZ=UTC # Set your timezone
        restart: unless-stopped
```

After deployment, access the web UI at `http://[address]:6868` to begin setup.

> **Note for Windows users:** The database is case-sensitive. Use a docker volume or the WSL file system to avoid issues:
>
> -   Docker volume example: `profilarr_data:/config`
> -   WSL filesystem example: `/home/username/docker/profilarr:/config`

### Complete Documentation

Visit our comprehensive documentation at [dictionarry.dev](https://dictionarry.dev/profilarr-setup/installation) for detailed installation instructions and usage guides.

## Status

Currently in beta. Part of the [Dictionarry](https://github.com/Dictionarry-Hub) project to simplify media automation.

### Known Issues

-   https://github.com/Dictionarry-Hub/profilarr/issues

### Personal Note

Profilarr is maintained by a single CS student with no formal development experience, in their spare time. Development happens when time allows, which may affect response times for fixes and new features. The project is continuously improving, and your patience, understanding, and contributions are greatly appreciated as Profilarr grows and matures.
