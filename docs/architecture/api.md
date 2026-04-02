# API

## Route Classification

Profilarr has two types of server routes: the public API and web app routes.

### Public API (`/api/v1/*`)

The versioned public API. All endpoints are documented in the OpenAPI spec
(`docs/api/v1/openapi.yaml`), follow a stable contract, and accept either a
session cookie or an `X-Api-Key` header for authentication.

Both auth methods exist because the web UI and external consumers share the same
endpoints. The UI calls them with a session cookie; scripts, dashboards, and
future mobile clients call them with an API key. This avoids duplicating
endpoints.

### Web App Routes (everything else)

Routes outside `/api/v1/` are internal to the web application:

- Session-only auth (API key requests get 403)
- Not in the OpenAPI spec
- No stability guarantees; can change freely

These fall into two categories:

**Page-local endpoints** are `+server.ts` files colocated with the pages that
use them. They exist because the page needs to fetch data client-side (e.g.
refreshing after a mutation) and form actions or server loads aren't practical.
Examples: `/databases/[id]/changes/data`, `/databases/[id]/commits/data`.

**Auth flows** handle login, logout, and OIDC callbacks under `/auth/*`.

**Form actions** on `+page.server.ts` files handle mutations (create, update,
delete) triggered by form submissions. These have no URL to hit externally.

## Authentication

Global security is defined at the top level of the OpenAPI spec:

```yaml
security:
  - apiKey: []
  - session: []
```

All `/api/v1/*` endpoints require auth by default. Public endpoints override
with `security: []` (e.g. the health check).

The auth middleware (`src/lib/server/utils/auth/middleware.ts`) enforces this by
path prefix. SvelteKit's built-in CSRF protection (Origin header check on
mutations) ensures session requests came from the Profilarr UI.

## Contract-First Workflow

New endpoints follow a spec-first process:

1. **Define** paths and schemas in `docs/api/v1/` (YAML)
2. **Generate** TypeScript types from the spec into `src/lib/api/v1.d.ts`
3. **Implement** the endpoint handler, using the generated types
4. **Test** with integration tests that verify the contract (status codes,
   response shape, auth behavior, no secret leakage)

### OpenAPI Spec Structure

```
docs/api/v1/
  openapi.yaml          # root spec, references paths and schemas
  paths/
    system.yaml         # /health, /health/diagnostics, /openapi.json
    databases.yaml      # /databases
    arr.yaml            # /arr/library, /arr/releases, etc.
    ...
  schemas/
    common.yaml         # shared types (ErrorResponse, ComponentStatus)
    health.yaml         # HealthCheckResponse, HealthDiagnosticsResponse
    databases.yaml      # DatabaseInstance
    ...
```

Paths and schemas are split into separate files by domain, referenced via
`$ref`. This keeps the root spec concise.

### Type Generation

After modifying the OpenAPI spec, regenerate the TypeScript types:

```bash
deno task generate:api-types
```

This runs `openapi-typescript` against `docs/api/v1/openapi.yaml` and outputs
`src/lib/api/v1.d.ts`. The generated file should be committed alongside spec
changes. Import types from `$api/v1` in endpoint handlers:

```ts
import type { components } from '$api/v1';
type MyResponse = components['schemas']['MySchema'];
```

### Endpoint Implementation

Handlers live under `src/routes/api/v1/` and export named HTTP method functions:

```ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	return json(data);
};
```

Use generated types from `$api/v1` to ensure responses match the spec.

## Endpoint Documentation Rules

Each endpoint description in the OpenAPI spec should answer:

1. **Why** it exists
2. **Who** calls it (uptime monitors, automation, web UI)
3. **What** it returns and key behaviors
4. **When** any timing, caching, or rate limiting applies

### Conventions

- Summaries: title case, 2-4 words, describe the action
- No "(public)" or "(authenticated)" in summaries; use the `security` field
- Tags group by domain (System, Databases, Arr, PCD), not by HTTP method
- Document all status codes with clear triggers
- Add explicit `example` values when the same schema serves multiple status
  codes (e.g. 200 healthy vs 503 unhealthy)

### Status Codes

| Code | When                                        |
| ---- | ------------------------------------------- |
| 200  | Success                                     |
| 400  | Invalid input (missing or malformed params) |
| 401  | No session or API key                       |
| 403  | Valid auth but not permitted                |
| 404  | Resource not found                          |
| 409  | Conflict (cooldown, in-progress operation)  |
| 503  | Service unhealthy                           |

## Testing

Every v1 endpoint has integration tests that verify:

- Auth enforcement (401 without credentials, 200 with API key or session)
- Response shape matches the contract (required fields present)
- No secret leakage (sensitive fields stripped)
- Correct behavior with seeded data

Tests use the shared harness (`tests/integration/harness/`), each running an
isolated server instance on a unique port with its own database.
