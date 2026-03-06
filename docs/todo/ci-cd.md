# CI/CD Pipeline Plan

## Triggers

- Push to `develop`
- PR to `develop`
- Hotfix branches (`hotfix/*`)

## Jobs

### 1. Lint, Format, Type Check

- `deno task lint` (ESLint + Prettier check)
- `deno task check` (svelte-check + deno check)

### 2. Unit Tests

- `deno task test` (Deno test runner)

### 3. Integration Tests

- Build preview server
- Run integration test specs (auth, CSRF, cookies, API key, sessions, OIDC, rate limiting, proxy, backup secrets)
- Requires Docker Compose for OIDC tests (mock-oauth2-server + Caddy)

### 4. E2E Tests

- Playwright against preview build
- OIDC E2E tests (separate Playwright config with Docker Compose services)

### 5. Security Scanning

- **Semgrep** — SAST scanner, catches injection, auth issues, crypto misuse. Free for open source. Use `semgrep ci` with `p/default` + `p/javascript` + `p/typescript` rulesets.

### 6. Build

- `deno task build` — verify production build succeeds
- Docker build (if applicable)

## Future

- Look into Renovate for automated dependency updates
