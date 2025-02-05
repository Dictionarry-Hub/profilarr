# Profilarr

[![Docker Pulls](https://img.shields.io/docker/pulls/santiagosayshey/profilarr)](https://hub.docker.com/r/santiagosayshey/profilarr)
[![Docker Stars](https://img.shields.io/docker/stars/santiagosayshey/profilarr)](https://hub.docker.com/r/santiagosayshey/profilarr)
[![GitHub issues](https://img.shields.io/github/issues/Dictionarry-Hub/profilarr)](https://github.com/Dictionarry-Hub/profilarr/issues)

Configuration management tool for Radarr/Sonarr that automates importing and version control of custom formats and quality profiles.

## Features

-   🔄 Automatic synchronization with remote configuration databases
-   🎯 Direct import to Radarr/Sonarr instances
-   🔧 Git-based version control of your configurations
-   ⚡ Preserve local customizations during updates
-   🛠️ Built-in conflict resolution

## Tech Stack

-   **Frontend**: React + Vite
-   **Backend**: Flask + Gunicorn
-   **Database**: SQLite

## Installation

### Docker Compose (recommended)

```yaml
services:
    profilarr:
        image: santiagosayshey/profilarr:beta # we're still in beta!
        container_name: profilarr
        ports:
            - 6868:6868
        volumes:
            - /path/to/your/data:/config
        environment:
            - TZ=UTC # Set your timezone
        env_file:
            - .env # Optional: Only needed if contributing to a database
        restart: unless-stopped
```

## Configuration

If you want to contribute to the a database, create a `.env` file:

```
GIT_USER_NAME=your_username
GIT_USER_EMAIL=your_email
PROFILARR_PAT=your_github_pat
```

### Port

The web interface is accessible on port 6868 by default.

### Volumes

| Path      | Description                                             |
| --------- | ------------------------------------------------------- |
| `/config` | Contains app database and cloned configuration database |

### Environment Variables

| Variable         | Description                                   | Required |
| ---------------- | --------------------------------------------- | -------- |
| `TZ`             | Timezone (e.g., America/New_York)             | Yes      |
| `GIT_USER_NAME`  | GitHub username for contributing              | No       |
| `GIT_USER_EMAIL` | GitHub email for contributing                 | No       |
| `PROFILARR_PAT`  | GitHub Personal Access Token for contributing | No       |

## Usage

1. Access the web interface at http://localhost:6868
2. Clone a configuration database and/or setup your own custom formats / quality profiles
3. Configure your Radarr/Sonarr instances, set what / when configuations should be imported

## Development

### Prerequisites

-   Docker and Docker Compose

### Local Setup

```bash
git clone https://github.com/Dictionarry-Hub/profilarr
cd profilarr
docker compose up --build
```

This will start both the Flask and Vite development servers.

## Join the Community

<img src="https://invidget.switchblade.xyz/Y9TYP6jeYZ" alt="Discord Invite">

## Support Development

-   💖 [GitHub Sponsors](https://github.com/sponsors/Dictionarry-Hub)
-   ☕ [Buy Me A Coffee](https://www.buymeacoffee.com/santiagosayshey)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Status

Currently in beta. Part of the [Dictionarry](https://github.com/Dictionarry-Hub) project to simplify media automation.
