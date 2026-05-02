# Clipboard

**Source:** `src/lib/client/utils/clipboard.ts`,
`src/lib/client/ui/modal/PasteModal.svelte`
**Lint rule:** `scripts/lint/clipboard.ts` (`deno task lint:clipboard`)

Browser clipboard access depends on secure contexts. Localhost is usually
allowed, but plain HTTP over a LAN is not. Profilarr is often accessed from
another device on the network, so direct Clipboard API calls can fail even
when the same action works during local development.

## Rules

Do not call `navigator.clipboard.writeText()` directly. Use
`copyToClipboard()` from `$lib/client/utils/clipboard`. The helper first tries
the Clipboard API, then falls back to a temporary textarea copy path for
non-secure HTTP origins.

Do not call `navigator.clipboard.readText()` directly. Browser paste fallback
cannot silently read arbitrary clipboard data, so use
`$ui/modal/PasteModal.svelte` and let the user paste into a textarea.

The clipboard lint script enforces both rules:

```bash
deno task lint:clipboard
```

- `no-direct-clipboard-copy` catches direct writes and `execCommand('copy')`.
- `no-direct-clipboard-paste` catches direct reads.

`src/lib/client/utils/clipboard.ts` is exempt because it owns the copy helper
implementation.

## Copy Pattern

```ts
const copied = await copyToClipboard(text);
if (copied) {
	alertStore.add('success', 'Copied to clipboard');
} else {
	alertStore.add('error', 'Failed to copy to clipboard');
}
```

Callers own success and failure alerts so messages can name the thing being
copied.

## Paste Pattern

Open `PasteModal` from the caller and handle `confirm` with the pasted text.
The modal is generic text UI. It does not parse JSON, validate payloads, or
show domain-specific alerts.

Callers should:

- parse and validate the pasted text;
- keep the modal open when validation fails;
- close the modal after a successful paste;
- use `alertStore.add()` for recoverable errors and success feedback.
