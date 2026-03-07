<br>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/lib/client/assets/banner-light.svg">
    <source media="(prefers-color-scheme: light)" srcset="src/lib/client/assets/banner-dark.svg">
    <img alt="Profilarr" src="src/lib/client/assets/banner-dark.svg" width="500">
  </picture>
</p>

<br>

<p align="center">
  <a href="https://github.com/Dictionarry-Hub/profilarr/releases"><img src="https://img.shields.io/github/v/release/Dictionarry-Hub/profilarr?color=blue" alt="GitHub release"></a>
  <a href="https://hub.docker.com/r/santiagosayshey/profilarr"><img src="https://img.shields.io/docker/pulls/santiagosayshey/profilarr?color=blue" alt="Docker Pulls"></a>
  <a href="https://github.com/Dictionarry-Hub/profilarr/blob/develop/LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue" alt="License"></a>
  <a href="https://dictionarry.dev/"><img src="https://img.shields.io/badge/Website-dictionarry.dev-blue" alt="Website"></a>
  <a href="https://discord.gg/2A89tXZMgA"><img src="https://img.shields.io/discord/1202375791556431892?color=blue&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://www.buymeacoffee.com/santiagosayshey"><img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-blue?logo=buy-me-a-coffee" alt="Buy Me A Coffee"></a>
  <a href="https://github.com/sponsors/Dictionarry-Hub"><img src="https://img.shields.io/badge/GitHub%20Sponsors-Support-blue?logo=github-sponsors" alt="GitHub Sponsors"></a>
</p>

<p>Manage quality profiles, custom formats, and release profiles across your Radarr and Sonarr instances. Define your profiles once with a Git-backed configuration database, then sync them to any number of *arr instances.</p>

> [!WARNING]
> V2 is under heavy development and is _NOT_ ready for production use. Use
> [Profilarr V1](https://github.com/Dictionarry-Hub/profilarr/tree/v1) until
> V2 is ready.

## Features

**Core**

- **Link** - Connect to configuration databases like the
  [Dictionarry database](https://github.com/Dictionarry-Hub/db) or any Profilarr
  Compliant Database (PCD)
- **Bridge** - Add your Radarr and Sonarr instances by URL and API key
- **Sync** - Push configurations to your instances. Profilarr compiles
  everything to the right format automatically

**For Users**

- **Ready-to-Use Configurations** - Stop spending hours piecing together
  settings from forum posts. Get complete, tested quality profiles, custom
  formats, and media settings designed around specific goals
- **Stay Updated** - Make local tweaks that persist across upstream updates.
  View changelogs, diffs, and revert changes when needed. Merge conflicts are
  handled transparently
- **Automated Upgrades** - The arrs don't search for the best release, they grab
  the first RSS item that qualifies. Profilarr triggers intelligent searches
  based on filters and selectors

**For Developers**

- **Unified Architecture** - One configuration language that compiles to
  Radarr/Sonarr-specific formats on sync. No more maintaining separate configs
  for each app
- **Reusable Components** - Regular expressions are separate entities shared
  across custom formats. Change once, update everywhere
- **OSQL** - Configurations stored as append-only SQL operations. Readable,
  auditable, diffable. Git-native version control with complete history
- **Testing** - Validate regex patterns, custom format conditions, and quality
  profile behavior before syncing

**Authentication**

- `AUTH=on` (default) - Username/password login with session-based auth
- `AUTH=oidc` - SSO via OpenID Connect provider
- `AUTH=off` - No authentication (use with external auth like Authentik/Authelia)
- Optional local bypass toggle for LAN access without login

API access via `X-Api-Key` header (bcrypt-hashed in DB). See
[security docs](docs/architecture/security.md) for details.

## Discord

We're most active on [Discord](https://discord.gg/2A89tXZMgA), where we post
announcements, help people troubleshoot their setups, and have the kind of
conversations that don't fit neatly into GitHub issues. If you've got questions
or want to follow along with development, that's where to find us.

## Documentation

See **[dictionarry.dev](https://dictionarry.dev/)** for complete installation,
usage, and API documenation.

## Getting Started

### Production

```yaml
services:
  profilarr:
    image: ghcr.io/dictionarry-hub/profilarr:latest
    container_name: profilarr
    ports:
      - '6868:6868'
    volumes:
      - ./config:/config
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Etc/UTC
      - PARSER_HOST=parser
      - PARSER_PORT=5000
    depends_on:
      parser:
        condition: service_healthy

  # Optional - only needed for CF/QP testing
  parser:
    image: ghcr.io/dictionarry-hub/profilarr-parser:latest
    container_name: profilarr-parser
    expose:
      - '5000'
```

> [!NOTE]
> The parser service is only required for custom format and quality profile
> testing. Linking, syncing, and all other features work without it. Remove the
> `parser` service and related environment variables if you don't need it.

### Development

**Prerequisites**

- [Git](https://git-scm.com/) (for PCD operations)
- [Deno](https://deno.com/) 2.x
- [.NET SDK](https://dotnet.microsoft.com/) 8.0+ (optional, for parser)

```bash
git clone https://github.com/Dictionarry-Hub/profilarr.git
cd profilarr
deno task dev
```

This runs the parser service and Vite dev server concurrently. See
[CONTRIBUTING.md](docs/CONTRIBUTING.md) for architecture documentation.

### Environment Variables

| Variable             | Default     | Description                                                                   |
| -------------------- | ----------- | ----------------------------------------------------------------------------- |
| `PUID`               | `1000`      | User ID for file permissions                                                  |
| `PGID`               | `1000`      | Group ID for file permissions                                                 |
| `UMASK`              | `022`       | File creation mask                                                            |
| `TZ`                 | `Etc/UTC`   | Timezone for scheduling                                                       |
| `PORT`               | `6868`      | Web UI port                                                                   |
| `HOST`               | `0.0.0.0`   | Bind address                                                                  |
| `APP_BASE_PATH`      | `/config`   | Base path for data, logs, backups                                             |
| `AUTH`               | `on`        | Auth mode: `on`, `off`, `oidc`                                                |
| `ORIGIN`             | —           | External URL for reverse proxy setups (e.g., `https://profilarr.example.com`) |
| `OIDC_DISCOVERY_URL` | —           | OIDC discovery endpoint (only when `AUTH=oidc`)                               |
| `OIDC_CLIENT_ID`     | —           | OIDC client ID (only when `AUTH=oidc`)                                        |
| `OIDC_CLIENT_SECRET` | —           | OIDC client secret (only when `AUTH=oidc`)                                    |
| `PARSER_HOST`        | `localhost` | Parser service host                                                           |
| `PARSER_PORT`        | `5000`      | Parser service port                                                           |

## License

[AGPL-3.0](LICENSE)

Profilarr is free and open source. You do not need to pay anyone to use it. If
someone is charging you for access to Profilarr, they are violating the spirit
of this project.
