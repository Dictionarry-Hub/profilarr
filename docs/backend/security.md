# Auth System

## Table of Contents

- [Overview](#overview)
- [Auth Modes](#auth-modes)
  - [AUTH=on](#authon-default)
  - [SSO (OIDC)](#sso-oidc)
  - [AUTH=off](#authoff)
  - [Accounts](#accounts)
  - [Login Scenarios](#login-scenarios)
  - [API Keys](#api-keys)
    - [Permissions](#permissions)
    - [Creating a Key](#creating-a-key)
- [Request Flow](#request-flow)
- [Security Features](#security-features)
  - [Hashing](#hashing)
  - [Rate Limiting](#rate-limiting)
  - [CSRF & Reverse Proxies](#csrf--reverse-proxies)
  - [Protected Paths](#protected-paths)
  - [Secret Stripping](#secret-stripping)
  - [Secrets Follow Their Destination](#secrets-follow-their-destination)
  - [XSS via Markdown / {@html}](#xss-via-markdown--html)
  - [Path Traversal](#path-traversal)
- [Test Coverage](#test-coverage)
  - [Unit Tests](#unit-tests-srctestsauth)
  - [Integration Tests](#integration-tests-srctestsintegrationspecs)
  - [Browser Tests](#browser-tests-testsflows)
  - [Security Scans](#security-scans)
    - [SAST - Semgrep](#sast--semgrep)
    - [Container Scanning - Trivy](#container-scanning--trivy)
    - [DAST - OWASP ZAP](#dast--owasp-zap)
  - [Infrastructure](#infrastructure)

## Overview

### Why security matters

Profilarr stores credentials for connected services: arr API keys, arr Basic
Auth credentials for reverse proxies, GitHub PATs, AI API keys, TMDB keys, and
notification webhooks.

The arr keys are the biggest risk. Sonarr/Radarr store indexer and tracker API
keys internally - exposing an arr API key gives access to the arr's full API,
which can retrieve all configured indexer credentials.

Ideally Profilarr never touches the open internet. Users should be connecting
via a VPN, Tailscale, or sitting behind an authenticating reverse proxy. The
built-in auth exists as a safety net - if someone does expose it, they're not
immediately wide open. As Seraphys (Dictionarry's Database Maintainer) likes to
say - It's _stupidity mitigation_. Patent Pending.

### Defence in depth

1. **Authentication** - gate access via username/password, OIDC, or API key.
   Enforced by `getAuthState()` in middleware and `handle()` in the server hook.
2. **Data exposure controls** - authenticated users never see raw secrets. The
   frontend receives boolean flags (`hasApiKey`, `hasPat`, `hasBasicAuth`)
   instead of actual values. Secrets are also stripped from backup downloads.
3. **Filesystem is the trust boundary** - encrypting secrets at rest would be
   theatre since the decryption key would also be on disk. Filesystem security
   (containers, unprivileged users, volume permissions) is the user's
   responsibility.

## Auth Modes

`AUTH` turns login on or off. SSO through OIDC is an add-on to `AUTH=on`: it is
enabled by setting all three `OIDC_*` settings. When login is on, API keys also
work through the `X-Api-Key` header.

| Variable             | Default | Description                                                   | Example                                                      |
| -------------------- | ------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| `AUTH`               | `on`    | Login: `on` or `off`. `oidc` is a deprecated alias for `on`   | `on`                                                         |
| `ORIGIN`             | -       | Browser-facing origins, comma-separated (CSRF, cookies, OIDC) | `http://192.168.1.10:6868,https://profilarr.mydomain.com`    |
| `OIDC_DISCOVERY_URL` | -       | OIDC provider discovery endpoint. Set all three to enable SSO | `https://auth.mydomain.com/.well-known/openid-configuration` |
| `OIDC_CLIENT_ID`     | -       | OIDC client ID. Set all three to enable SSO                   | `profilarr`                                                  |
| `OIDC_CLIENT_SECRET` | -       | OIDC client secret. Set all three to enable SSO               | `your-secret`                                                |

The settings are parsed at startup by `parseAuthConfig()` in
`src/lib/server/utils/config/auth.ts`. Profilarr refuses to start, with an
error log line naming the problem, when:

- some but not all of the `OIDC_*` settings are set (unless `AUTH=off`), so a
  typo can't silently turn SSO off and open first-run setup
- `AUTH=oidc` is set without any `OIDC_*` settings
- SSO accounts exist, SSO is not enabled, and there's no password account
  (`getStartupAuthError()`, checked once the database is open). Without this,
  losing the `OIDC_*` settings would open first-run setup on an instance that
  was in use. To stop using SSO, create a password account first.

The login decisions live in `src/lib/server/utils/auth/loginOptions.ts`:

- The login page shows the password form when a password account exists, and
  the SSO button when SSO is enabled. If both are true, it shows both.
- First-run setup (`/auth/setup`) is only open when `AUTH=on`, SSO is not
  enabled, and no password account exists. With SSO enabled, the first user
  signs in with SSO instead, so setup is never left open to whoever reaches it
  first.

### AUTH=on (default)

Username/password login with session-based auth. Without SSO, the first visit
is redirected to `/auth/setup` to create the password account. Only one password
account can exist. Passwords are bcrypt-hashed. Sessions default to 7 days with
sliding expiration - matching Sonarr's approach (ASP.NET's `SlidingExpiration`),
which re-issues when more than halfway through the expiration window. Sonarr
uses ASP.NET's built-in cookie middleware for this; we implement it manually
against SQLite in `maybeExtendSession()`.

#### Sessions

Stored in the `sessions` table with metadata: IP, user agent, browser, OS,
device type, last active. Duration is configured in
`auth_settings.session_duration_hours` (default 7 days). Sliding expiration
extends the session when less than half the duration remains. Expired sessions
are cleaned up on startup. Password and SSO sign-ins create the same kind of
session. Each session also records `confirmed_at`, the last time the person
proved who they are: set at sign-in, refreshed by an explicit confirmation (see
[Creating a Key](#creating-a-key)), never by ordinary activity. Changing the
password clears it on the account's other sessions. Settings > Security lists sessions from every account, and can revoke
one session or every session except the current one. The page gets a SHA-256
handle for each session, never its ID: the ID is the cookie value, so exposing
it would let a script in the page read what the `httpOnly` cookie hides.

Cookie properties:

| Property   | Value                                       |
| ---------- | ------------------------------------------- |
| `httpOnly` | `true`                                      |
| `sameSite` | `lax`                                       |
| `secure`   | `true` when the request's origin is `https` |
| `path`     | `/`                                         |

### SSO (OIDC)

Delegates sign-in to an external OIDC provider (Authentik, Keycloak, Google,
etc.). Enabled with `AUTH=on` and all three `OIDC_*` settings. Both
`/auth/oidc/login` and `/auth/oidc/callback` return 400 when SSO is not
enabled. The flow uses state cookies for CSRF protection, nonce cookies for
token replay prevention, and verifies JWT signatures via the provider's JWKS
endpoint using the `jose` library. Any user the provider authenticates for the
client gets in; Profilarr has no allowlist of its own.

```mermaid
sequenceDiagram
    participant B as Browser
    participant P as Profilarr
    participant IDP as OIDC Provider

    B->>P: GET /auth/oidc/login
    P->>P: SSO enabled? (400 if not)
    P->>P: Generate state + nonce
    P->>P: Store in cookies (10min TTL)
    P->>B: 302 to IDP authorization URL

    B->>IDP: User authenticates
    IDP->>B: 302 to /auth/oidc/callback?code=...&state=...

    B->>P: GET /auth/oidc/callback
    P->>P: SSO enabled? (400 if not)
    P->>P: Verify state matches cookie (CSRF)
    P->>IDP: Exchange code for tokens
    IDP->>P: id_token + access_token
    P->>P: Verify JWT signature via JWKS (jose)
    P->>P: Verify issuer, audience, expiry
    P->>P: Verify nonce matches cookie (replay)
    P->>P: Get or create SSO account (oidc:<sub>)
    P->>P: Create session
    P->>B: Set session cookie, redirect /
```

**Re-authentication.** Some actions need a recent proof of identity (see
[Creating a Key](#creating-a-key)). For an SSO session, `/auth/oidc/login?reauth=1`
runs the same flow with `prompt=login` and `max_age=60`, which asks the
provider to authenticate the person again rather than reuse its own session.
`max_age` is the same 60-second allowance the callback applies below; it is
never sent as `0`, which Authelia can never satisfy.
The callback then requires the ID token's `auth_time` claim to be newer than
the moment the flow started and its `sub` to match the signed-in account. On
success the existing session is marked confirmed and kept; no new session is
created. A provider that returns no fresh `auth_time` (Google does not support
the request) fails closed and returns to the Security page, which suggests
creating a local account.

`AUTH=oidc` is a deprecated alias for `AUTH=on`. Startup logs a warning asking
for `AUTH=on`; if a password account exists, the warning also says the login
page now shows the password form. The alias is marked for removal in v3.0.0.
Removing it is a breaking change: an instance still on `AUTH=oidc` without a
password account would fall back to `AUTH=on` and open first-run setup.

### AUTH=off

No auth checks. All requests are allowed through. Intended for deployments
behind an authenticating reverse proxy like Authelia or Authentik. The setup
and login pages redirect to `/`, Log Out is hidden, and the `OIDC_*` settings
are ignored.

### Accounts

Password and SSO accounts share the `users` table. Every account is a full
admin. An SSO account's username is `oidc:` plus the provider's `sub` claim, and
its password hash is the placeholder `OIDC_NO_PASSWORD`, so it can never sign in
with a password. The `oidc:` prefix, compared ignoring case, is the only thing
that tells the two apart (`isOidcUsername()`, and `NOT LIKE 'oidc:%'` in
`usersQueries`). For that reason, usernames starting with `oidc:` are refused
wherever a password account is created.

| State         | `users` rows                                                              |
| ------------- | ------------------------------------------------------------------------- |
| Password only | One row, e.g. `admin` with a bcrypt hash                                  |
| SSO only      | One `oidc:<sub>` row per person who has signed in with SSO                |
| Both          | The password row alongside the SSO rows. They aren't linked to each other |

On Settings > Security, the page adapts to how the current session signed in:

- **Password session:** Change Password, as before.
- **SSO session, no password account:** Create Local Account, which adds the
  one password account as a fallback for when the provider is unavailable. It
  does not switch the current session.
- **SSO session, password account exists:** neither form. The password is
  changed by signing in with it.

A password account keeps working after the person's SSO access is revoked at
the provider. There is no way to delete a password account from the app.

### Login Scenarios

| Scenario                                      | What happens                                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| New install, no SSO                           | First visit goes to setup to create the password account. The login page then shows the password form.                                          |
| New install with SSO                          | No setup page. The login page shows only the SSO button. A password account can be added later from Settings > Security.                        |
| Password account, no SSO                      | The login page shows only the password form.                                                                                                    |
| SSO only                                      | The login page shows only the SSO button.                                                                                                       |
| SSO and a password account                    | The login page shows both. Either one signs in.                                                                                                 |
| `AUTH=oidc` (deprecated), no password account | Same as SSO only, plus the startup deprecation warning.                                                                                         |
| `AUTH=oidc` with a leftover password account  | Same as SSO and a password account. The startup warning points out that the password form is now shown.                                         |
| `AUTH=on` with leftover `OIDC_*` settings     | All three set: the SSO button appears. Only some set: Profilarr won't start until they're fixed or removed.                                     |
| `AUTH=off`                                    | No login. The `OIDC_*` settings are ignored.                                                                                                    |
| SSO removed, no password account              | Profilarr refuses to start until the `OIDC_*` settings are restored. To stop using SSO, create a password account in Settings > Security first. |
| SSO provider down                             | Sign in with the password account if one exists. Otherwise there's no way in until the provider is back.                                        |
| Typo in the `OIDC_*` settings                 | Profilarr won't start, and the error names the missing setting.                                                                                 |

### API Keys

Available in all modes except `AUTH=off`. Checked before session checks in the
request flow.

- Header: `X-Api-Key`
- Scoped to `/api/v1/` paths only. Browser pages and SvelteKit form actions
  require a real session. Requests with a valid API key to other paths get 403.
  This prevents an API key from being used as a second admin login (e.g.
  creating keys or changing auth settings via settings form actions).
- Keys are named, stored in `api_keys`, and managed in Settings > Security.
  They are only created and deleted; nothing about a key changes after
  creation, so a key can never widen its own access.
- Each key has full access (`"all"`) or per-area access: `read` or `write`
  (write includes read) per OpenAPI tag. `"all"` covers areas added later.
- Keys expire after 30 days, 90 days, 1 year, or never. An expired key gets 401
  `API key has expired`.
- Key is bcrypt-hashed in the database; the plaintext is shown once at creation.
  The last 4 characters are stored so the UI can tell keys apart.
- Keys carry no identifier, so an unknown key is checked against every stored
  hash with async bcrypt `verify()`. Keys that have matched are remembered in
  memory by SHA-256, and their row is re-read on each request, so deletion and
  expiry take effect immediately.
- `last_used_at` is updated at most once a minute per key.
- `PROFILARR_API_KEY` adds a key from the environment. It must be at least 32
  characters long. The value is a plaintext runtime secret, is not persisted to
  SQLite, and is not bcrypt-hashed. It always has full access and works
  alongside stored keys.
- Invalid keys are logged with a masked value (`****` + last 4 chars)

#### Creating a Key

A new key is a long-lived credential, so creating one asks the person to
confirm their identity first. A script running in a hijacked session cannot do
that: it doesn't know the password, and it can't complete a sign-in at the
provider. The check depends on how the current session signed in, and a
confirmation is remembered on the session (`confirmed_at`) for 30 minutes, so
creating several keys in a row asks once. Signing in counts as a confirmation.

The gate is enforced by the `create` action in
`src/routes/settings/security/api-keys/new/+page.server.ts` using
`isRecentlyConfirmed()` from `src/lib/server/utils/auth/confirmation.ts`. On
the Security page, New Key opens a modal that asks for the confirmation and
only then opens the form. The form page shows the same modal for direct links
and for a confirmation that lapses while it is open; a refused submit brings
it back. The New Key link is never preloaded, so the form page's data is
fetched only when it actually opens, after the confirmation.

Password session:

```mermaid
flowchart TD
    A[New Key clicked] --> B{Session confirmed<br>in last 30 min?}
    B -->|Yes| K[Open the form; create key,<br>show plaintext once]
    B -->|No| C{Password field<br>filled in?}
    C -->|No| D[400: enter your password]
    C -->|Yes| E{Password matches<br>account hash?}
    E -->|No| F[400: wrong password]
    E -->|Yes| G[Mark session confirmed now]
    G --> K
```

The password check shares the login rate limiter, so guessing is throttled the
same way as at the login page.

SSO session:

```mermaid
flowchart TD
    A[New Key clicked] --> B{Session confirmed<br>in last 30 min?}
    B -->|Yes| K[Open the form; create key,<br>show plaintext once]
    B -->|No| C[Confirm with SSO:<br>/auth/oidc/login?reauth=1]
    C --> D[Redirect to provider with<br>prompt=login and max_age=60]
    D --> E[Provider re-authenticates the user]
    E --> F[Callback: usual token checks]
    F --> G{sub matches the session and<br>auth_time newer than when we started?}
    G -->|No| H[Session stays unconfirmed.<br>Back to Security: provider could not<br>confirm you, create a local account]
    G -->|Yes| I[Mark session confirmed now]
    I --> J[Back on the key form]
    J --> K
```

An SSO session cannot confirm with a password, and a password session cannot
confirm through the SSO route. With `AUTH=off` there is no session, so there is
nothing to confirm; keys don't work in that mode anyway.

#### Permissions

Each authenticated `/api/v1` operation declares `x-permission: read | write` in
the OpenAPI spec, and its single tag is its area. At startup
`src/lib/server/utils/auth/apiPermissions.ts` reads the bundled spec into a
lookup of method + path to area and access. On each request the matched route
id is converted to the spec's path form (parameter names ignored) and checked
against the key:

- Full-access keys pass without a lookup.
- Operations with no label are denied to scoped keys (fail closed). The
  `lint:api-permissions` rule fails CI if an authenticated operation is missing
  its label or does not have exactly one tag, or if a route handler under
  `src/routes/api/v1` doesn't resolve to a labelled operation (a handler
  missing from the spec, or a route path that doesn't match its spec path).
- A key without the required access gets 403, e.g.
  `API key does not have write access to Databases`.
- HEAD is treated as GET.

## Request Flow

```mermaid
flowchart TD
    REQ[Incoming Request] --> GAS[getAuthState]

    GAS --> OFF{AUTH=off?}
    OFF -->|Yes| S_OFF["skipAuth=true
    needsSetup=false
    user=null"]

    OFF -->|No| APIKEY{"X-Api-Key
    header present?"}
    APIKEY -->|Valid| S_API["skipAuth=false
    needsSetup=false
    user=api"]
    APIKEY -->|Invalid or expired| LOG_BAD[Log warning] --> SESS
    APIKEY -->|No header| SESS

    SESS["Check session cookie
    (password and SSO sessions)"] --> S_ON["skipAuth=false
    needsSetup = no password account
    and SSO not enabled
    user=session user or null"]

    S_OFF --> HOOK
    S_API --> HOOK
    S_ON --> HOOK

    HOOK[handle hook]
    HOOK --> NEED_SETUP{needsSetup?}

    NEED_SETUP -->|Yes| IS_SETUP{Path = /auth/setup?}
    IS_SETUP -->|Yes| RESOLVE[Resolve]
    IS_SETUP -->|No| R_SETUP[Redirect /auth/setup]

    NEED_SETUP -->|No| SKIP{skipAuth?}
    SKIP -->|Yes| RESOLVE

    SKIP -->|No| BLOCK_SETUP{Path = /auth/setup?}
    BLOCK_SETUP -->|Yes| R_HOME[Redirect /]

    BLOCK_SETUP -->|No| PUBLIC{Public path?}
    PUBLIC -->|Yes| RESOLVE

    PUBLIC -->|No| IS_KEY{API key auth?}
    IS_KEY -->|Yes| V1{/api/v1 path?}
    V1 -->|No| RESP_403[403 JSON]
    V1 -->|Yes| PERM{"Key has the operation's
    x-permission?"}
    PERM -->|No| RESP_403
    PERM -->|Yes| ATTACH

    IS_KEY -->|No| HAS_USER{auth.user?}
    HAS_USER -->|Yes| EXTEND[Sliding expiration] --> ATTACH[Attach to locals] --> RESOLVE

    HAS_USER -->|No| IS_API{/api path?}
    IS_API -->|Yes| RESP_401[401 JSON]
    IS_API -->|No| R_LOGIN[Redirect /auth/login]

    style RESOLVE fill:#059669,color:#fff
    style RESP_401 fill:#dc2626,color:#fff
    style RESP_403 fill:#dc2626,color:#fff
    style R_SETUP fill:#d97706,color:#fff
    style R_HOME fill:#d97706,color:#fff
    style R_LOGIN fill:#d97706,color:#fff
```

## Security Features

### Hashing

Passwords and Profilarr API keys are both bcrypt-hashed. Passwords are hashed
at account creation and password change. API keys are hashed at creation; the
plaintext is returned once for the user to copy, then only the hash and the
last 4 characters are persisted. Validation uses async bcrypt `verify()` in
both cases.

Hashing goes through `utils/auth/bcrypt.ts`, which uses `bcryptjs` (pure
JavaScript) at cost 12. A stored hash carries its own cost and salt, so hashes
made by the native `@felix/bcrypt` library Profilarr used before still verify.

This differs from most apps in the arr ecosystem. Sonarr, Radarr, and similar
tools store their API keys as plaintext in the database and always display them
to authenticated users in settings. Profilarr treats API keys more like
passwords - hashed on storage, shown once at creation, never retrievable
afterward. This is closer to how services like GitHub and Stripe handle API
keys.

### Rate Limiting

Login endpoint (`/auth/login`) has SQLite-backed rate limiting with a 15-minute
window. Failed attempts are categorized to apply different thresholds:

| Category     | Threshold | Trigger                                                        |
| ------------ | --------- | -------------------------------------------------------------- |
| `suspicious` | 3         | Common attack usernames (admin, root, test, guest, etc.)       |
| `typo`       | 10        | Wrong password for existing user, or Levenshtein distance <= 2 |
| `unknown`    | 10        | Everything else                                                |

Rate limit state is stored in SQLite rather than in-memory. An in-memory counter
resets on process restart - if an attacker can trigger repeated crashes (and the
process manager auto-restarts), they can brute-force credentials by resetting
the rate limit with each crash. SQLite persistence survives restarts, so
accumulated attempts are never lost.

Attempts are cleared on successful login and expired attempts are cleaned up on
startup.

Rate limiting uses the real TCP connection address
(`getClientIp(event, false)`), not proxy headers. This prevents an attacker from
bypassing the rate limit by rotating `X-Forwarded-For` values with each request.
Session metadata (the IP shown in the active sessions list) still uses proxy
headers so users behind a reverse proxy see the correct client IP for display
purposes.

### CSRF & Reverse Proxies

SvelteKit's CSRF check compares the `Origin` request header against
`new URL(request.url).origin`, so the request URL must carry the origin the
browser used, not the address the container listens on. The production entry
(`src/runtime/server.js`) resolves that origin for every request before
`@sveltejs/adapter-node` builds the SvelteKit `Request`, using the rules in
`src/runtime/origins.js`:

| `ORIGIN`         | Request origin                                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unset            | The socket's scheme and the `Host` header. Direct access over HTTP works without configuration.                                                                                                                             |
| One value        | Always that origin, whatever the proxy sends.                                                                                                                                                                               |
| Several (commas) | The listed origin whose host matches `Host`, or `X-Forwarded-Host` when a proxy rewrote `Host`. `X-Forwarded-Proto` only picks between listed origins that share a host. No match: the same as unset, logged once per host. |

Forwarded headers can only select an origin that is already listed; they can't
add one. Each listed origin is a separate origin to SvelteKit, so a form loaded
on one can't post to another. An address that matches nothing is served from
its own `Host`, so the image's health check on `localhost`, probes on the
container name and API clients keep working; only a browser behind an HTTPS
proxy on such an address has its forms refused by the CSRF check. Values must
be scheme, host and optional port only. Startup fails on anything else.

Everything that depends on the origin reads it from the request
(`event.url`): the session, OIDC state and nonce cookies get `secure` on
`https` origins, and the OIDC redirect URI is `${event.url.origin}/auth/oidc/callback`,
so each listed origin must be registered with the provider. The callback also
checks it arrived on the origin that started the flow and answers `400`
otherwise; cookies are shared across the schemes and ports of one hostname, so
the state cookie alone can't tell `http://host` from `https://host`.

The check covers `POST`, `PUT`, `PATCH`, and `DELETE` requests whose
`Content-Type` is a form type (`application/x-www-form-urlencoded`,
`multipart/form-data`, `text/plain`) or missing, and only runs in production
builds. API clients that don't send an `Origin` header must send a non-form
`Content-Type` such as `application/json`; multipart uploads still need a
matching `Origin`.

### Protected Paths

Every route is protected by default - the server hook rejects unauthenticated
requests unless the path is explicitly allowlisted in `publicPaths.ts`. This is
the first line of defence and needs to be airtight: a missing entry redirects to
login, but an overly broad allowlist exposes protected pages to the internet.
New public paths must be added deliberately with a clear reason.

The current public allowlist:

| Path                  | Why public                                        |
| --------------------- | ------------------------------------------------- |
| `/auth/setup`         | First-run setup - no credentials exist yet        |
| `/auth/login`         | Must be reachable to authenticate                 |
| `/auth/oidc/login`    | Initiates redirect to external OIDC provider      |
| `/auth/oidc/callback` | Provider redirects back here after authentication |
| `/api/v1/health`      | Uptime monitors need this without credentials     |

Everything else requires a valid session or API key.
`/auth/logout` is not public - it requires an existing session to clear.

Page-level guards add further restrictions on top:

- `/auth/setup` redirects to `/` unless first-run setup is open (`AUTH=on`, SSO
  not enabled, no password account)
- `/auth/login` redirects to `/` with `AUTH=off`, and to `/auth/setup` while
  setup is open; otherwise it shows the password form, the SSO button, or both
- `/auth/oidc/login` and `/auth/oidc/callback` return 400 unless SSO is enabled

### Secret Stripping

Secrets are stripped at two levels:

- **Frontend responses** - server-side load functions replace sensitive fields
  with boolean flags (`hasApiKey`, `hasPat`, `hasBasicAuth`). Notification
  service secrets (webhook URLs, tokens, auth headers) are removed by
  `stripNotificationSecrets()` in `src/lib/server/notifications/secrets.ts`
  before the edit page receives a config, and the list page receives no config
  at all. Arr instances pass through `toPublicArrInstance()` in
  `src/lib/server/db/queries/arrInstances.ts`, which removes the API key and the
  Basic Auth username and password. Password hashes never leave the server.
- **Backup downloads** - local backup archives on disk are full-fidelity; the
  filesystem is the documented trust boundary, so a backup file sitting next
  to the live database does not need to be sanitized. The download endpoint
  (`GET /api/v1/backups/{filename}`) instead sanitizes the archive on the fly
  before streaming the response. Sanitization deletes whole rows from
  `arr_instances` (cascading through arr-side sync, drift, rename, cleanup,
  and upgrade tables) and `notification_services` (cascading through
  history), and empties `users`, `sessions`, and `login_attempts`. Personal
  access tokens on `database_instances`, AI keys on `ai_settings`, and TMDB
  keys on `tmdb_settings` are nulled but the rows are kept (PCD repos remain
  linked, schedules and other settings preserved). Embedded HTTP(S)
  credentials are also stripped from cloned PCD repository `.git/config`
  remote URLs. Clones no longer save the token there (git gets it as a
  header, see [utilities.md](./utilities.md#git)), so this guards backups
  taken by older versions. API keys are removed: `api_keys` is emptied, or in
  backups from before migration 072, `auth_settings.api_key` is nulled.
  SQLite keeps deleted rows in the file's free space, so the sanitizer enables
  `secure_delete` before removing anything and runs `VACUUM` afterwards; the
  backup secrets test also searches the downloaded files' raw bytes for the
  seeded secrets. The local archive on disk and the production database are
  never modified. See `src/lib/server/utils/backup/sanitize.ts`
  for the exact policy.

### Secrets Follow Their Destination

A stored secret must be re-entered whenever the place it is sent to changes.
Update forms keep the stored secret when its field is left blank, so without
this rule a request that changed only the destination would re-point the
stored secret at a new host on its next use. Any re-entered value will do: a
wrong one replaces the stored secret instead of exposing it.

`requireSecretForDestinationChange()` in
`src/lib/server/utils/secretDestination.ts` enforces it. It rejects a request
when the destination changed, a secret is stored, and no secret was submitted.
The forms covered, and the field that counts as the destination:

| Form                      | Secret               | Destination field |
| ------------------------- | -------------------- | ----------------- |
| Arr instance settings     | API key              | URL               |
| Ntfy notification service | Access token         | Server URL        |
| Generic webhook service   | Authorization header | Webhook URL       |

Arr URLs are compared after `normalizeArrInstanceUrl()`
(`src/lib/shared/utils/arrUrl.ts`), so a trailing slash or default port is
not a change. The forms mirror the rule: the secret field becomes required as
soon as the destination field differs from the stored value. The notification
edit page tells the form which secret keys exist (`storedSecrets`) without
sending their values.

Arr Basic Auth is optional, so a URL change clears it instead of requiring it.
Once the URL differs, blank Basic Auth fields count as empty rather than as
the stored values, so the credentials are removed unless both are re-entered.
The form warns under the fields before saving, and an alert confirms the
removal. Test Connection falls back to an instance's saved credentials only
while its URL is unchanged.

The ESLint rule `profilarr/secret-destination`
(`scripts/lint/rules/secret-destination.ts`) keeps the decision explicit.
Every `+page.server.ts` that reads a secret form field must import the guard
or start with `/* eslint-disable profilarr/secret-destination -- <reason> */`,
used by the create-only actions and by forms whose secret goes to a fixed host.

### XSS via Markdown / {@html}

Svelte's `{@html}` directive renders raw HTML without escaping. Any content that
flows through `{@html}` without sanitisation is an XSS vector.

**The attack**: Profilarr clones PCD databases maintained by community
developers. These databases contain markdown fields: quality profile and custom
format descriptions, regex descriptions, announcements. A malicious or
compromised developer could put a tag with an inline event handler in one of
them. Every user who links that database would run it whenever the description
renders, inside their authenticated session.

**Mitigation**: descriptions are markdown only. `renderMarkdown()` in
`src/lib/shared/utils/markdown.ts` is the single renderer, used on the server
and in the browser, and every `{@html}` of author content takes its output. It
configures `marked` so that:

- raw HTML in the source, block or inline, is escaped and shown as text;
- link and image URLs are entity-decoded, whitespace-stripped and checked
  against a scheme allowlist (`http:`, `https:`, `mailto:`, relative). A
  rejected link keeps only its text; a rejected image keeps only its alt text;
- `links: false` turns every link into plain text, for descriptions shown
  inside a card that is itself a link.

The result then passes through `sanitizeHtml()` in `sanitize.ts` as a second
layer. It parses each tag the way a browser does (quoted, unquoted and
valueless attributes, slash separators), rebuilds allowed tags from allowlisted
attributes only, drops everything else including the content of raw-text
elements such as `<script>`, and escapes any `<` that does not form a
well-formed tag. In normal operation it changes nothing, because `marked` has
already produced clean output. It exists so a change in `marked` cannot quietly
reopen the page to author-written markup.

**Semgrep enforcement**: `tests/scan/semgrep/xss.yml` fails on any `marked`
import outside the shared renderer, and flags every `{@html}` and any raw
variable in `{@html}` for review. Because Semgrep uses regex matching for Svelte
(no AST support), reviewed-safe `{@html}` uses carry a `nosemgrep` comment with
justification.

### Path Traversal

Several endpoints accept client-supplied file paths (for selective commits,
previews, and AI commit message generation). Without validation, an attacker
with a valid session or API key could use `../../` sequences or absolute paths
to escape the repository boundary and read or copy arbitrary files.

**The attack**: An authenticated user sends a POST to
`/api/databases/[id]/generate-commit-message` with
`{ "files": ["../../etc/passwd"] }`. The server resolves this relative to the
database's `local_path`, reads the file content via `fs.readFile`, and
sends it to the configured AI provider. The attacker exfiltrates arbitrary
server files through the AI proxy. The commit and preview endpoints have similar
vectors via `fs.copyFile` and `getDiff()`.

A subtler variant uses symlinks. A malicious PCD database maintainer commits a
symlink (`evil -> /etc`) into their repo. Git tracks symlinks as blob entries,
so it survives clone. A path like `evil/passwd` passes a naive lexical check (it
resolves inside the repo directory) but follows the symlink to `/etc/passwd`
when the filesystem actually reads it.

**Mitigation**: `validateFilePaths()` in `#utils/paths.ts` checks every
client-supplied path before any filesystem operation:

1. Rejects absolute paths (`/etc/passwd`)
2. Resolves relative paths against the repo root and verifies the result stays
   within the boundary (lexical `startsWith` check)
3. Follows symlinks via `realpathSync()` and verifies the real path is
   still within the boundary (catches symlink escapes)

**Known limitation**: The boundary check uses POSIX path separators (`/`). If
Windows becomes a supported deployment target, this will need to handle
backslash-separated paths from `resolve()` on Windows.

Validation is applied at three layers:

- **Route handlers** (`+server.ts`, `+page.server.ts`) - early reject with HTTP
  400 before any work begins
- **Exporter functions** (`previewDraftOps`, `exportDraftOps`) - defense in
  depth before clone/copy operations
- **`getDiff()`** - defense in depth so any future callers are also protected

## Test Coverage

### Unit Tests (`tests/unit/auth/`)

Pure function tests for the core auth utilities - IP classification, path
allowlisting, and login failure analysis. No server instances or network calls
needed.

| File                        | Tests                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `network.test.ts`           | `getClientIp` proxy header handling with trustProxy on/off                                  |
| `publicPaths.test.ts`       | Public vs protected path matching, prefix vs exact, no overly broad allowlist entries       |
| `loginAnalysis.test.ts`     | Attack username detection, Levenshtein typo matching (1-2 edits), failure categorization    |
| `apiPermissions.test.ts`    | Route id to spec path mapping, permission lookup, read/write/area checks, area list         |
| `authConfig.test.ts`        | `AUTH` parsing, `oidc` alias, SSO enablement, partial `OIDC_*` settings refused             |
| `oidcConfigStartup.test.ts` | Partial `OIDC_*` settings stop `config.ts` from loading; ignored with `AUTH=off`            |
| `loginOptions.test.ts`      | Login page options, first-run setup, and the startup lockout for every combination          |
| `accountValidation.test.ts` | Password account rules, reserved `oidc:` prefix, prefix check matches the SQL in queries    |
| `confirmation.test.ts`      | Confirmation window edges and the re-authentication claim checks (`sub`, `auth_time`, skew) |

**Sanitize tests** (`tests/unit/sanitize/`):

| File               | Tests                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sanitize.test.ts` | Output filter: quoted and unquoted event handlers, obfuscated `javascript:` URLs, disallowed attributes and tags; each payload checked raw and after `marked`; allowed markup kept |
| `markdown.test.ts` | Renderer: raw HTML escaped in block and inline mode, link and image scheme checks, `links: false`, GFM features intact                                                             |

### Integration Tests (`tests/integration/specs/auth/`)

Each spec boots an isolated server instance and tests a specific auth behaviour
end-to-end over HTTP. Uses the shared harness with `TestClient` (cookie jar),
server lifecycle helpers, and Docker Compose for OIDC/TLS scenarios. Specs run
in parallel under Vitest via `pnpm test:integration`.

| File                             | Port                  | Tests                                                                                                                                     |
| -------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `health.test.ts`                 | 7006                  | Public health vs authenticated diagnostics, no info disclosure                                                                            |
| `csrf.test.ts`                   | 7003, 7004, 7005      | Origin checking, no-origin fallback, reverse proxy CSRF with `ORIGIN`                                                                     |
| `cookie.test.ts`                 | 7001, 7002            | Secure flag (HTTPS vs HTTP), httpOnly, SameSite, path, expiration                                                                         |
| `apiKey.test.ts`                 | 7000                  | Valid/invalid key, header-only, 401 on missing, 403 for non-API paths and key management                                                  |
| `apiKeyPermissions.test.ts`      | 7020                  | Read vs write, other areas, unknown access values, expiry 401, deletion, last_used_at                                                     |
| `envApiKey.test.ts`              | 7018                  | Env key works alongside stored keys, "Environment" name reserved                                                                          |
| `session.test.ts`                | 7016                  | Redirect flow, expiration, sliding expiration halfway extend, 401 JSON, logout CSRF protection                                            |
| `oidc.test.ts`                   | 7007, 7008, 7009      | Full OIDC flow, state/nonce tampering, rejected when SSO isn't enabled, proxy flow                                                        |
| `loginMethods.test.ts`           | 7021-7027, 7029, 7031 | One server per login scenario: setup, login page options, sign-in, `oidc` alias warning, lockout                                          |
| `localAccount.test.ts`           | 7028, 7030            | Create Local Account from an SSO session, refusals, change password guard, sessions across accounts                                       |
| `rateLimit.test.ts`              | 7012                  | Suspicious/typo thresholds, successful login clears, window expiry                                                                        |
| `proxy.test.ts`                  | 7011                  | Full flow through Caddy TLS, X-Forwarded-For recording, CSRF through proxy                                                                |
| `xForwardedFor.test.ts`          | 7017                  | Spoofed header limited to session metadata; login throttling uses real TCP                                                                |
| `secretExposure.test.ts`         | 7015                  | 16 page checks - no raw secrets in frontend responses (assumes stolen session)                                                            |
| `pathTraversal.test.ts`          | 7010                  | 15 checks - ../ , absolute path, and symlink escape rejection across 3 endpoints                                                          |
| `localBypass.test.ts`            | 7019                  | Local bypass removal: requests from local addresses require auth                                                                          |
| `xss.test.ts`                    | 7032                  | Seeded PCD descriptions with an unquoted event handler never reach custom format or profile page HTML                                     |
| `secretDestinations.test.ts`     | 7033                  | Arr, Ntfy and webhook updates that change the destination are rejected unless the secret is re-entered                                    |
| `apiKeyConfirmation.test.ts`     | 7034                  | Key creation needs a confirmed session: window edges, wrong and right password, sessions stay separate, password change, rate limit       |
| `oidcReauth.test.ts`             | 7035, 7036            | SSO re-authentication: `max_age` sent, same session kept and confirmed, wrong account rejected, provider without `auth_time` fails closed |
| `reverseProxy502.test.ts`        | 7013                  | Login and SSR pages through nginx with a small `proxy_buffer_size`; nginx never logs an oversized upstream header                         |
| `reverseProxy502-manual.test.ts` | 7014                  | Interactive version of the above for browser checks; skipped unless `INTEGRATION_MANUAL=1`                                                |

### Browser Tests (`tests/flows/`)

Browser-level security checks live in the flow suite, described in
[flow-tests.md](./flow-tests.md). `scenarios/security/markdown.spec.ts` checks
that custom format and announcement markdown with an unquoted event handler
never runs, server-rendered and client-rendered.

### Security Scans (`tests/scan/`)

Security scans run via `pnpm scan:*`. Semgrep is intended to run in CI/CD as a
blocking check. ZAP is manual-only, run periodically for spot checks.

#### SAST - Semgrep

Static Application Security Testing. Scans source code for vulnerabilities
without running the application.

```bash
pnpm scan:semgrep          # full scan: custom rules + community rulesets
pnpm scan:semgrep --quick  # custom rules only (faster, for iteration)
```

The full scan uses `--error` so it exits non-zero on any finding. The goal is
zero findings - any unresolved finding is either a real bug to fix or a false
positive to suppress with a justification comment.

**Community rulesets** (from Semgrep Registry):

- `p/default`, `p/owasp-top-ten`, `p/security-audit` (general security)
- `p/typescript`, `p/javascript`, `p/nodejs` (language-specific)
- `p/csharp` (for the C# parser service)

**Custom rulesets** (`tests/scan/semgrep/`):

| File          | What it catches                                                                        |
| ------------- | -------------------------------------------------------------------------------------- |
| `xss.yml`     | `{@html}` usage, `marked` imported outside the shared renderer, unescaped table cells  |
| `sql.yml`     | Template literal interpolation in SQL (exempts known-safe patterns)                    |
| `secrets.yml` | Sensitive field names in logger metadata                                               |
| `node.yml`    | Template literal command paths, `eval`, request-derived file paths, env values in logs |
| `csharp.yml`  | C# parser service patterns (file I/O review)                                           |

**Suppressing false positives**: Use `nosemgrep` with the full rule ID and a
justification. The comment must be on the matched line or the line immediately
before it. Semgrep ignores comments separated by intervening lines.

```ts
// nosemgrep: profilarr.xss.table-cell-html-unescaped - all values use escapeHtml()
html: `<div>${escapeHtml(row.name)}</div>`;
```

For Svelte templates where JS comments aren't valid, use an HTML comment on the
same line as the `{@html}`:

```svelte
{@html renderMarkdown(text)}<!-- nosemgrep: profilarr.xss.at-html-usage -->
```

**Limitations**:

- Community rules are free-tier only (no cross-file taint analysis)
- Svelte files use generic/regex matching, not AST. Rules can't trace data flow
  through function calls, so sanitised-but-flagged code needs `nosemgrep`
- No dependency vulnerability scanning (Semgrep Supply Chain requires login).
  Trivy partially covers this gap for OS-level packages in the container image
  (see below).

#### Container Scanning - Trivy

Scans Docker images for known vulnerabilities in OS packages. Trivy pulls apart
image layers, checks every installed package against vulnerability databases
(NVD, distro advisories), and reports each CVE with severity and fix
availability.

**Where it runs:**

- **CI** (`ci.yml`): a `trivy` job runs in parallel with lint, type-check,
  unit tests, and semgrep. It builds both Docker images (`profilarr` and
  `profilarr-parser`) from their Dockerfiles and scans them. PRs with
  CRITICAL or HIGH CVEs fail the check.
- **Release script** (`pnpm release`): builds and scans both images
  before prompting for the version tag. If either scan fails, the release
  aborts before tagging. Requires `trivy` on PATH.

**Configuration:**

- Severity threshold: `CRITICAL,HIGH`
- Exit code 1 on findings (blocking in both CI and release)
- CI uses the `aquasecurity/trivy-action` GitHub Action
- Release script uses the `trivy` CLI directly

**Future considerations:** scheduled scanning (weekly cron against `:latest`
and `:develop` on GHCR) would catch new CVE advisories published after a
release. Currently cut because the fix is always "release a new version," so
the value over CI + release gating is low.

#### DAST - OWASP ZAP

Dynamic Application Security Testing. Runs a live scan against compiled
Profilarr instances to find runtime vulnerabilities (missing headers, cookie
issues, information disclosure, etc.). Requires `pnpm build` and Docker.

```bash
pnpm scan:zap --baseline  # passive scan (spider + check responses)
pnpm scan:zap --full      # passive + active attacks (SQLi, XSS, etc.)
pnpm scan:zap --api       # API scan against OpenAPI spec (not yet implemented)
```

Each mode starts two servers and runs ZAP against both:

| Port | Config   | Purpose                                       |
| ---- | -------- | --------------------------------------------- |
| 7090 | AUTH=on  | Unauthenticated - tests what an outsider sees |
| 7091 | AUTH=off | Full crawl - ZAP can reach all routes         |

The `--api` mode will scan the OpenAPI spec once the API overhaul lands (see
`docs/todo/api-overhaul.md`). Uses the `-I` flag so warnings don't fail the
scan - only errors do.

### Infrastructure

- **Test harness**: `tests/integration/harness/`, `TestClient` with cookie jar,
  `startServer`/`stopServer` for isolated instances
- **Docker Compose**: mock-oauth2-server (port 9090) + Caddy (TLS termination)
  for OIDC and proxy tests, started once per run by Vitest's global setup
  (`INTEGRATION_DOCKER=0` skips it)
- **Tasks**: `pnpm test:unit` and `pnpm test:integration` run the
  Vitest suites; `pnpm scan:semgrep` and `pnpm scan:zap` run the scans
