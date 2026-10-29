/**
 * Guard for update actions that hold a secret and the destination it is
 * sent to (an Arr API key and its URL, a webhook auth header and its URL).
 *
 * Rule: a stored secret must be re-entered whenever its destination changes.
 * The forms keep the stored secret when the field is blank, so without this
 * check a request that changes only the destination would re-point the
 * stored secret at a new host on its next use. Any re-entered value will do:
 * a wrong one replaces the stored secret instead of exposing it.
 *
 * Every `+page.server.ts` that reads a secret form field must use this guard
 * or switch `profilarr/secret-destination` off for the file with a reason
 * (`scripts/lint/rules/secret-destination.js`).
 */

export interface SecretDestinationCheck {
	/** True when the submitted destination differs from the stored one. */
	destinationChanged: boolean;
	/** The secret currently stored, if any. Nothing to protect when empty. */
	storedSecret: string | null | undefined;
	/** The secret submitted with this request, if any. */
	submittedSecret: string | null | undefined;
	/** Shown in the error, e.g. "API key". */
	secretLabel: string;
	/** Shown in the error, e.g. "URL". */
	destinationLabel: string;
}

/** Returns an error message to show the user, or null when the change is allowed. */
export function requireSecretForDestinationChange(check: SecretDestinationCheck): string | null {
	if (!check.destinationChanged) return null;
	if (!check.storedSecret) return null;
	if (check.submittedSecret?.trim()) return null;
	return `Enter the ${check.secretLabel} to change the ${check.destinationLabel}.`;
}
