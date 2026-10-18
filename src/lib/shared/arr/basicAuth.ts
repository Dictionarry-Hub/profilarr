/**
 * Basic Auth for an Arr instance is saved as a pair. The client only sends the
 * header when both are set, so one without the other would be stored and
 * never used. Pure, so the forms, the actions and the query layer share it.
 */

/** Why a Basic Auth pair can't be saved, or null if it can. */
export function basicAuthPairError(hasUsername: boolean, hasPassword: boolean): string | null {
	if (hasUsername && !hasPassword) return 'Basic Auth needs a password to go with the username';
	if (hasPassword && !hasUsername) return 'Basic Auth needs a username to go with the password';
	return null;
}
