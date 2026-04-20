# Dev Bulletin Fixtures

Static fixtures mirroring the layout of `Dictionarry-Hub/bulletin`. Used by
`deno task dev:bulletin` to serve a fake endpoint locally so the dev server
can exercise the announcements + version-check code paths without hitting the
real bulletin repo.

## Layout

```
scripts/dev-bulletin/
├── versions.json
├── announcements.json
└── announcements/
    └── <ulid>.md
```

## Usage

```bash
# Terminal 1: serve fixtures on http://localhost:6970
deno task dev:bulletin

# Terminal 2: run dev with PROFILARR_BULLETIN_URL pointed at the fake
PROFILARR_BULLETIN_URL=http://localhost:6970 deno task dev
```

Without the env var, `deno task dev` hits the real
`raw.githubusercontent.com/Dictionarry-Hub/bulletin/main` — that's the default
and is the usual case.

## Editing fixtures

- `versions.json` and `announcements.json` must validate against the bulletin
  repo schemas (`schema/versions.schema.json`, `schema/announcements.schema.json`).
- Each announcement needs a matching `<id>.md` body file.
- ULIDs use Crockford Base32 (26 chars, no `I L O U`).

After editing, the dev file server needs to be restarted to pick up new
content (it reads from disk on each request, so file changes reflect live
without a restart).
