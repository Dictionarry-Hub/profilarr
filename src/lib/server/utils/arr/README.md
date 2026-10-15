# Arr HTTP Client Utilities

Object-oriented HTTP client architecture for communicating with \*arr
applications (Radarr, Sonarr, Lidarr, Chaptarr).

## Architecture

### Class Hierarchy

```
BaseHttpClient (generic HTTP operations)
    ↓
BaseArrClient (arr-specific features: API key auth, common patterns)
    ↓
RadarrClient, SonarrClient, LidarrClient, ChaptarrClient (specific API methods)
```

### File Structure

```
src/utils/http/
├── client.ts           # BaseHttpClient - connection pooling, basic HTTP methods
└── types.ts            # TypeScript types for HTTP requests/responses

src/utils/arr/
├── base.ts             # BaseArrClient - arr-specific auth, common patterns
├── radarr.ts           # RadarrClient - Radarr API methods
├── sonarr.ts           # SonarrClient - Sonarr API methods
├── lidarr.ts           # LidarrClient - Lidarr API methods
├── chaptarr.ts         # ChaptarrClient - Chaptarr API methods
├── factory.ts          # Factory function to create client by type
├── types.ts            # Arr-specific types
└── README.md           # This file
```

## Class Responsibilities

### BaseHttpClient (`src/utils/http/client.ts`)

Base HTTP client with generic request capabilities.

**Features:**

- Connection pooling (using Deno's built-in `fetch` with keep-alive)
- Basic HTTP methods: `get()`, `post()`, `put()`, `delete()`, `patch()`
- Request/response handling
- Error handling
- Configurable timeouts
- Base URL management

**Constructor:**

```typescript
new BaseHttpClient(baseUrl: string, options?: HttpClientOptions)
```

**Methods:**

- `get<T>(path: string, options?: RequestOptions): Promise<T>`
- `post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>`
- `put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>`
- `delete<T>(path: string, options?: RequestOptions): Promise<T>`
- `patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>`

### BaseArrClient (`src/utils/arr/base.ts`)

Base client for all \*arr applications. Extends `BaseHttpClient`.

**Features:**

- Automatically adds `X-Api-Key` header to all requests
- Common arr API patterns (pagination, filtering)
- Version detection via `/api/{version}/system/status` and the unversioned `/api` route

**Constructor:**

```typescript
new BaseArrClient(url: string, apiKey: string)
```

**Methods:**

- `detectVersion(): Promise<ArrVersionInfo>` - App name and version from `system/status`, plus the API generation `GET /api` reports as current (`null` if that route is missing). Throws when `system/status` is unreachable.
- `testConnection(): Promise<boolean>` - `detectVersion()` reduced to pass/fail, with a log line
- All methods from `BaseHttpClient`

### Future Usage (when specific methods are implemented)

```typescript
import { createArrClient } from '$utils/arr/factory.ts';

const radarr = createArrClient('radarr', 'http://localhost:7878', 'api-key');

// Get movies
const movies = await radarr.getMovies();

// Get quality profiles
const profiles = await radarr.getQualityProfiles();

// Add movie
await radarr.addMovie({
	title: 'Inception',
	tmdbId: 27205,
	qualityProfileId: 1
});
```
