# Base URL

Profilarr can be served from a subpath behind a reverse proxy, the equivalent of
Radarr's and Sonarr's **URL Base** setting:

```
https://media.example.com/profilarr
```

Set it with the `BASE_URL` env var. It is read at startup and applies to the whole app.

```yaml
environment:
  - ORIGIN=https://media.example.com
  - BASE_URL=/profilarr
```

The value is used exactly as given. Write it with a leading slash and no trailing slash,
like `/profilarr`. Unset or empty means "served from the root". Nothing is normalized,
so a value in any other shape is simply wrong and will behave that way.

`ORIGIN` is only ever the origin, meaning scheme, host and port. It is never a source
for the subpath: SvelteKit's CSRF check compares `ORIGIN` against the browser's Origin
header, which cannot carry a path. Configure the subpath with `BASE_URL` and nowhere
else.

## Proxy configuration

Pass the prefix through. Do **not** strip it:

```caddy
media.example.com {
	reverse_proxy /profilarr* profilarr:6868
}
```

```nginx
location /profilarr/ {
	proxy_pass http://profilarr:6868;   # note: no trailing slash, so the prefix is kept
	proxy_set_header Host $host;
	proxy_set_header X-Forwarded-Proto $scheme;
}
```

When `BASE_URL` is set, Profilarr serves **only** from that subpath. Anything outside it
gets a 404, the same as Radarr and Sonarr. A proxy that strips the prefix, or hitting the
container port directly, will therefore 404 on every request. This includes container
health checks, which have to target `/profilarr/api/v1/health`.

## How it works

SvelteKit's `paths.base` is build time config, and Profilarr ships as a prebuilt binary,
so the base cannot be baked in. Instead, it is applied at the two boundaries:

**Incoming.** `src/adapter/files/mod.ts` strips the prefix off `request.url` before
anything else looks at it, using `stripBaseUrl`. Static files, pre-rendered routes and
SvelteKit's router all see plain app paths, exactly as if there were no prefix. A path
outside the base never reaches the app at all.

**Outgoing.** SvelteKit is built with `paths.relative` (its default), so it renders URLs
relative to the page. At `/profilarr/settings/general` the asset and `resolve()`
expressions resolve against the document, which puts the prefix back. In the browser the
runtime prefix is `/profilarr`. During SSR it is a relative prefix such as `..` or
`../..`.

Assets imported through Vite (`import logo from '$assets/logo-512.png'`) are the one
exception. The browser resolves them from the importing chunk's own location, so they
come out right there, but the SSR bundle inlines them as `/_app/...` paths anchored at
the server root. The `rebaseAssetUrls` chunk transform in `src/hooks.server.ts` puts the
prefix back on those, which covers every asset import without each component having to
remember.

That split is the one thing to keep in mind when writing code:

| Context                              | Use                                                                  |
| ------------------------------------ | -------------------------------------------------------------------- |
| Client markup, `fetch`, `goto`       | `resolve('/path')` from `$app/paths`                                 |
| Server redirects                     | `redirect()` from `$utils/redirect/redirect.ts`                      |
| Server side external URLs            | `config.externalUrl` (origin + base URL)                             |
| Comparing a path against the current | `routePath()` / `isRouteActive()` from `$lib/client/utils/routePath` |

`resolve()` is preferred over the deprecated `base` export because it typechecks the
path against the app's generated route union, so a link to a route that does not exist
fails `deno task check` instead of 404ing in production.

Comparisons need `routePath()` because the two sides do not match raw:
`page.url.pathname` carries the prefix in the browser but not during SSR, and hrefs built
with `resolve()` are absolute in the browser but relative during SSR. `routePath()`
normalises both back to a plain app path.

`deno task lint:base-url` enforces the first two rows. It flags `href="/x"`,
`fetch('/x')`, `goto('/x')`, a reintroduced `${base}`, and
`import { redirect } from '@sveltejs/kit'` in server files. Escape hatch:
`// lint-disable-next-line base-url -- reason`.

## Cookies

Session cookies stay on `path=/` rather than the base URL. Two Profilarr instances on the
same host under different subpaths would share a cookie name, which is the trade off for
keeping cookie scope independent of the subpath.

## OIDC

The redirect URI is `${ORIGIN}${BASE_URL}/auth/oidc/callback`. Register that exact URL
with your provider. `config.externalUrl` is what builds it.

## Testing it locally

```bash
deno task build
deno task preview:proxy --base-url /profilarr
```

That runs the compiled binary behind Caddy on `http://profilarr.localhost:8080/profilarr`
with the prefix passed through, which is the configuration users actually run.

`vite dev` always serves from the root. The adapter is not in the loop there, so
`BASE_URL` has no effect on `deno task dev`.
