# Cutscene Onboarding System

## Table of Contents

- [Overview](#overview)
- [Steps](#steps)
  - [Completion Types](#completion-types)
- [Stages](#stages)
- [Pipelines](#pipelines)
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

New users see a prompt on first load asking if they want a guided tour. This is
driven by a database flag (`onboarding_shown` on `general_settings`) that's set
whether the user accepts or dismisses. Users can replay any stage or pipeline
later from the `/onboarding` page, accessible via the help button.

## Steps

A step is a single instruction: spotlight an element, show a card, and wait for
the user to do something. Steps are the building blocks of everything else.

```ts
interface Step {
	id: string;
	route?: string;
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

`route` auto-navigates when the step becomes active. If the user is already on
that route, nothing happens.

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
}
```

`silent` skips the completion modal when this stage finishes as the last stage in
a run. Used for stages like Help where a "you're done" modal would be redundant.

### Current Stages

| ID            | Name        | Steps | Description                                                            |
| ------------- | ----------- | ----- | ---------------------------------------------------------------------- |
| `welcome`     | Welcome     | 10    | Sidebar walkthrough: what Profilarr is and what each section does      |
| `personalize` | Personalize | 2     | Theme toggle and accent color picker                                   |
| `databases`   | Databases   | 6     | Linking a database: form fields, PAT, conflict strategy, sync settings |
| `help`        | Help        | 1     | Introduces the help button (silent)                                    |

## Pipelines

A pipeline chains stages together in order. When one stage completes, the next
begins automatically.

```ts
interface Pipeline {
	id: string;
	name: string;
	description: string;
	stages: string[];
}
```

The `stages` array contains stage IDs referencing entries in the stage registry.

### Current Pipelines

| ID                | Name            | Stages                                   | Description                                  |
| ----------------- | --------------- | ---------------------------------------- | -------------------------------------------- |
| `getting-started` | Getting Started | Welcome → Personalize → Databases → Help | First-run onboarding covering the essentials |

## Adding Content

**Adding a step** to an existing stage: add an entry to the stage's `steps`
array and tag the target element with `data-onboarding`:

```svelte
<div data-onboarding="my-target">...</div>
```

If the step uses `state` completion, register the check function in
`src/lib/client/cutscene/stateChecks.ts`:

```ts
export const stateChecks: Record<string, () => Promise<boolean>> = {
	myCheck: async () => {
		const res = await fetch('/api/v1/...');
		return res.ok;
	}
};
```

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

The stage automatically appears on the `/onboarding` page.

**Adding a pipeline**: create a file in `definitions/pipelines/` and register it
in `definitions/index.ts`:

```ts
// definitions/pipelines/my-pipeline.ts
import type { Pipeline } from '../../types.ts';

export const myPipeline: Pipeline = {
	id: 'my-pipeline',
	name: 'My Pipeline',
	description: 'A guided experience',
	stages: ['stage-one', 'stage-two', 'stage-three']
};
```

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

Runtime state is managed by a Svelte writable store. Progress (active pipeline,
current stage/step) is saved to localStorage on every state change, so
refreshing mid-walkthrough picks up where the user left off.

The only server-side persistence is the `onboarding_shown` flag on
`general_settings` (migration 058). This controls whether the first-run prompt
appears. Once set, it's never unset.

Cutscenes started from the onboarding page are flagged as `manualStart`. When a
manually started cutscene completes, the completion modal appears offering to
return to the onboarding page. Cutscenes started from the first-run prompt skip
this.

## Onboarding Page

`/onboarding` lists all registered pipelines and stages. Users can start a full
pipeline or replay an individual stage. The page supports table/card view toggle
and search by name or description.

The help button (parrot) includes an "Onboarding" link to this page on desktop.

## Mobile

Cutscene is disabled on screens below 768px. The overlay, prompt, and completion
modal don't mount. The onboarding link is hidden in the mobile help button.

The current stages spotlight sidebar elements which aren't visible on mobile.
Supporting mobile would require either different stages or a different spotlight
approach for the bottom navigation.
