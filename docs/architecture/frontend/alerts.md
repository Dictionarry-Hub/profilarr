# Alerts

**Source:** `src/lib/client/alerts/` (`$alerts/*`)
**Mount:** `src/routes/+layout.svelte:62`

## Table of Contents

- [Store](#store)
- [Settings](#settings)
- [Consuming Alerts](#consuming-alerts)
- [Not for Load Errors](#not-for-load-errors)

Alerts are the app's toast notification system: transient messages that appear
at a configured screen edge, auto-dismiss after a timeout, and can be clicked
to dismiss early. They are the channel for ephemeral feedback ("Settings
saved", "Failed to unlink database"). For confirmations, use
`$ui/modal/Modal.svelte`; for field-level errors, render next to the field.

## Store

`store.ts` exposes a Svelte store with four methods: `add`, `remove`, `clear`,
`subscribe`. Severity is one of `'success' | 'error' | 'warning' | 'info'`.

```ts
alertStore.add('success', 'Settings saved successfully!');
alertStore.add('error', 'Failed to save');
alertStore.add('error', 'Tag already added.', 2000); // override duration
alertStore.add('warning', 'Parser service unavailable.', 0); // persistent
```

`add` returns the new alert id. If `duration` is omitted, the default comes
from `alertSettingsStore.durationMs`. `duration === 0` disables auto-dismiss:
the alert stays until the user clicks it. Use it sparingly, for warnings the
user must acknowledge.

The store does not dedupe or cap queue length. Callers that fire repeatedly
must throttle themselves (see `TagInput.svelte` for the reference pattern).

## Settings

`settings.ts` stores `position` (one of six edges / corners) and `durationMs`
in `localStorage` under the key `alertSettings`. Defaults are `top-center`
and `8000`. Settings are client-only: SSR always starts from the defaults
and the client picks up the stored preference on hydration.

The settings UI in `src/routes/settings/general/+page.svelte` presents
duration in **seconds**; the store holds **milliseconds**. Conversion
happens at the boundary (`* 1000` on save, `/ 1000` on read).

## Consuming alerts

Most alerts come from two places: direct calls in event handlers, and the
`use:enhance` callback on form submissions.

The form-action pattern is the convention worth knowing. Server actions
return failures via `fail(status, { error: '...' })`, and `use:enhance`
translates the result into an alert:

```svelte
<!-- src/routes/settings/general/+page.svelte:239-258 -->
<form
    method="POST"
    action="?/save"
    use:enhance={() => {
        saving = true;
        return async ({ result, update: formUpdate }) => {
            if (result.type === 'failure' && result.data) {
                alertStore.add('error', (result.data as { error?: string }).error || 'Failed to save');
            } else if (result.type === 'success') {
                alertStore.add('success', 'Settings saved successfully!');
            }
            saving = false;
            await formUpdate({ reset: false });
        };
    }}
>
```

The shape is consistent across the codebase: the error string comes from the
server (`result.data.error` with a hardcoded fallback), the success string is
hardcoded on the client. Pages with several actions usually extract a factory
(see `src/routes/databases/[id]/conflicts/+page.svelte:47` for an example)
to avoid repeating the branch.

## Not for load errors

Errors thrown in `+page.server.ts` or `+layout.server.ts` `load` functions
are routed through SvelteKit's `+error.svelte`, which renders a full-page
error view. Alerts are for _recoverable_ failures the user can retry;
thrown errors are for _route-breaking_ failures where no useful page can
render.
