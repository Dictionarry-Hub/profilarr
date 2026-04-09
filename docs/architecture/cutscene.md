# Cutscene Onboarding System

## Table of Contents

- [Overview](#overview)
- [Steps](#steps)
  - [Completion Types](#completion-types)
  - [Dynamic Routes](#dynamic-routes)
- [Stages](#stages)
- [Prerequisites](#prerequisites)
- [Groups](#groups)
- [Adding Content](#adding-content)
- [Overlay Engine](#overlay-engine)
- [Store & Persistence](#store--persistence)
- [Onboarding Page](#onboarding-page)
- [Mobile](#mobile)

## Overview

Cutscene is an interactive onboarding system that guides users through Profilarr
by cutting holes in the scene. A dark overlay covers the application and
spotlight cutouts reveal the elements the user needs to interact with. Users
click real buttons, navigate real pages, and make real changes while the overlay
controls what's visible and clickable.

The name comes from two things: cutting holes in the scene, and like a gaming
cutscene, the app takes over to guide you through a narrative before handing
control back.

When a cutscene starts, the overlay finds the current step's target element via
`data-onboarding` attributes in the DOM, cuts a spotlight around it, and shows
an instruction card. The user completes the step by satisfying a condition, and
the overlay advances. The spotlight animates smoothly between targets, and
navigation between pages is handled automatically.

New users see a prompt on first load asking if they want a guided tour. This
starts the Welcome stage, which introduces Profilarr and ends at the onboarding
page where users can run any stage at their own pace. The prompt is driven by a
database flag (`onboarding_shown` on `general_settings`) that's set whether the
user accepts or dismisses.

## Steps

A step is a single instruction: spotlight an element, show a card, and wait for
the user to do something. Steps are the building blocks of everything else.

```ts
interface Step {
	id: string;
	route?: string | { resolve: string };
	target?: string;
	title: string;
	body: string;
	position?: Position;
	freeInteract?: boolean;
	completion: Completion;
}
```

`target` matches a `data-onboarding` attribute in the DOM. If omitted, the
instruction card appears centered with no spotlight.

`route` auto-navigates when the step becomes active. Can be a static string or
a dynamic resolver (see [Dynamic Routes](#dynamic-routes)).

`position` controls where the instruction card sits relative to the target:
`above`, `below`, `left`, `right`, `above-left`, `above-right`, `below-left`,
`below-right`. Defaults to `below`.

`freeInteract` disables the click-blocking overlay for this step, allowing the
user to interact with the full UI. Used when a step involves opening dropdowns or
interacting beyond the spotlight target.

### Completion Types

`completion` defines how the step advances:

| Type     | What happens                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| `click`  | Advances when the spotlight target is clicked. Uses a MutationObserver if the element isn't in the DOM yet. |
| `route`  | Advances when the browser's pathname matches the specified path.                                            |
| `state`  | Advances when a named async check function returns true. Functions are registered in `stateChecks.ts`.      |
| `manual` | Shows a Continue button on the instruction card.                                                            |

When the completion type is not `manual`, the forward button is hidden from the
progress bar. The user must satisfy the completion condition to advance.

### Dynamic Routes

Steps can use dynamic route resolvers for pages that require runtime data (e.g.
navigating to a specific database or Arr instance). Instead of a static route
string, use an object referencing a named resolver:

```ts
route: {
	resolve: 'firstDatabaseChanges';
}
```

Resolvers are registered in `src/lib/client/cutscene/routeResolvers.ts`. Each
resolver is an async function that returns a path string:

```ts
export const routeResolvers: Record<string, () => Promise<string>> = {
	firstDatabaseChanges: async () => {
		const res = await fetch('/api/v1/databases');
		const dbs = await res.json();
		return `/databases/${dbs[0].id}/changes`;
	}
};
```

## Stages

A stage groups steps into a self-contained lesson that teaches one thing. Stages
are independent and can be run on their own from the onboarding page.

```ts
interface Stage {
	id: string;
	name: string;
	description: string;
	steps: Step[];
	silent?: boolean;
	prerequisites?: Prerequisite[];
}
```

`silent` skips the completion modal when this stage finishes. Used for stages
like Help where a "you're done" modal would be redundant.

`prerequisites` gates the stage behind runtime conditions. See
[Prerequisites](#prerequisites) below.

### Current Stages

| ID                | Name        | Steps | Prerequisites    | Description                                     |
| ----------------- | ----------- | ----- | ---------------- | ----------------------------------------------- |
| `welcome`         | Welcome     | 3     |                  | What Profilarr is and how it works              |
| `navigation`      | Navigation  | 5     |                  | The main sections of the app                    |
| `personalize`     | Personalize | 2     |                  | Theme toggle and accent color picker            |
| `help`            | Help        | 1     |                  | Introduces the help button (silent)             |
| `database-link`   | Link        | 7     |                  | Connect a configuration database                |
| `database-manage` | Overview    | 6     | `hasDatabase`    | Tabs and features of a connected database       |
| `arr-link`        | Link        | 5     |                  | Connect a Radarr or Sonarr instance             |
| `arr-manage`      | Overview    | 7     | `hasArrInstance` | Tabs and features of a connected Arr instance   |
| `arr-sync`        | Sync        | 7     | `hasArrInstance` | Configure what gets synced and when             |
| `arr-upgrades`    | Upgrades    | 11    | `hasArrInstance` | Automated searching for better quality releases |
| `arr-renames`     | Rename      | 7     | `hasArrInstance` | Automated file and folder renaming              |

## Prerequisites

A prerequisite gates a stage behind a runtime condition. Before a stage starts,
its prerequisites are checked. If any check fails, the cutscene does not start
and the user sees an error alert with the prerequisite's message.

```ts
interface Prerequisite {
	check: string;
	message: string;
}
```

`check` references a named function in the `stateChecks` registry
(`src/lib/client/cutscene/stateChecks.ts`). Each function is async and returns a
boolean.

`message` is shown via `alertStore` when the check returns false.

### How checks run

The prerequisite runner (`src/lib/client/cutscene/prerequisites.ts`) collects
prerequisites from the requested stage, runs each check in order, and returns on
the first failure.

### Adding a prerequisite

1. Add a check function to `stateChecks.ts`:

```ts
export const stateChecks: Record<string, () => Promise<boolean>> = {
	hasDatabase: async () => {
		const res = await fetch('/api/v1/databases');
		if (!res.ok) return false;
		const data = await res.json();
		return data.length > 0;
	}
};
```

2. Add the prerequisite to the stage definition:

```ts
prerequisites: [{ check: 'hasDatabase', message: 'You need at least one connected database.' }];
```

The same check function can be referenced by multiple stages.

## Groups

Groups organize stages visually on the onboarding page. They have no runtime
behavior; stages within a group run independently.

```ts
interface StageGroup {
	name: string;
	description: string;
	stages: string[];
}
```

Groups are defined in `definitions/index.ts`:

```ts
export const GROUPS: StageGroup[] = [
	{
		name: 'Getting Started',
		description: 'Learn the basics of Profilarr',
		stages: ['welcome', 'navigation', 'personalize', 'help']
	},
	{
		name: 'Databases',
		description: 'Connect and manage configuration databases',
		stages: ['database-link', 'database-manage']
	}
];
```

### Current Groups

| Name            | Stages                                            |
| --------------- | ------------------------------------------------- |
| Getting Started | Welcome, Navigation, Personalize, Help            |
| Databases       | Connect a Database, Managing a Database           |
| Arr Instances   | Connect an Arr Instance, Managing an Arr Instance |

## Adding Content

**Adding a step** to an existing stage: add an entry to the stage's `steps`
array and tag the target element with `data-onboarding`:

```svelte
<div data-onboarding="my-target">...</div>
```

If the step uses `state` completion, register the check function in
`src/lib/client/cutscene/stateChecks.ts`.

If the step needs a dynamic route, register a resolver in
`src/lib/client/cutscene/routeResolvers.ts`.

**Adding a stage**: create a file in `src/lib/client/cutscene/definitions/stages/`
and register it in `definitions/index.ts`:

```ts
// definitions/stages/my-stage.ts
import type { Stage } from '../../types.ts';

export const myStage: Stage = {
	id: 'my-stage',
	name: 'My Stage',
	description: 'What this stage teaches',
	steps: [
		{
			id: 'first-step',
			target: 'my-target',
			title: 'Do This',
			body: 'Click the thing to continue.',
			position: 'right',
			completion: { type: 'click' }
		}
	]
};
```

```ts
// definitions/index.ts
import { myStage } from './stages/my-stage.ts';

export const STAGES: Record<string, Stage> = {
	// ...existing
	'my-stage': myStage
};
```

Add the stage to a group in `GROUPS` so it appears on the onboarding page.

## Overlay Engine

The overlay uses two layers working together:

- **SVG mask** handles the visual darkening. A full-screen rectangle is masked
  with a rounded cutout where the target element is. This layer has
  `pointer-events: none` everywhere; it's purely visual.

- **CSS clip-path** handles click blocking. A separate div with
  `pointer-events: auto` uses a clip-path polygon that covers everything except
  the cutout area. Clicks in the cutout pass through to the real UI beneath.

Both layers are needed because SVG masks don't affect pointer events. The
spotlight finds its target via `querySelector('[data-onboarding="..."]')` and
recalculates on scroll, resize, and navigation.

## Store & Persistence

Runtime state is managed by a Svelte writable store. Progress (active stage and
current step) is saved to localStorage on every state change, so refreshing
mid-walkthrough picks up where the user left off.

The only server-side persistence is the `onboarding_shown` flag on
`general_settings` (migration 058). This controls whether the first-run prompt
appears. Once set, it's never unset.

Cutscenes started from the onboarding page are flagged as `manualStart`. When a
manually started cutscene completes, the completion modal appears offering to
return to the onboarding page. Cutscenes started from the first-run prompt skip
this.

## Onboarding Page

`/onboarding` shows stages organized by group. Each group displays its name,
description, and the stages within it. Users can start any individual stage.

The help button (parrot) includes an "Onboarding" link to this page on desktop.

## Mobile

Cutscene is disabled on screens below 768px. The overlay, prompt, and completion
modal don't mount. The onboarding link is hidden in the mobile help button.

The current stages spotlight sidebar elements which aren't visible on mobile.
Supporting mobile would require either different stages or a different spotlight
approach for the bottom navigation.
