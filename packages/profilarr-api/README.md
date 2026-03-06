# @dictionarry/profilarr-api

OpenAPI specification and TypeScript types for the
[Profilarr](https://github.com/Dictionarry-Hub/profilarr) API.

## Usage

```ts
import { spec } from '@dictionarry/profilarr-api';
import type { components } from '@dictionarry/profilarr-api';

// Access the bundled OpenAPI 3.1 spec
console.log(spec.info.title); // "Profilarr API"
console.log(spec.paths);

// Use typed schemas
type Movie = components['schemas']['RadarrLibraryItem'];
type Series = components['schemas']['SonarrLibraryItem'];
type Episode = components['schemas']['SonarrEpisodeItem'];
```

## What's included

- **`spec`** — Bundled OpenAPI 3.1 specification (all `$ref`s resolved)
- **Type exports** — TypeScript interfaces for all API schemas, paths, and operations
