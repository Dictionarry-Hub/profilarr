## Description

Allow password and SSO login together so users can retain a local fallback.

### Behavior

Show both login options when both are configured. Reject incomplete OIDC settings
at startup to avoid an unusable login page.

## Related issue

Closes #606

## User-facing docs

Companion authentication guide update: https://github.com/Dictionarry-Hub/profilarr.com/pull/123

## Technical docs

Updated README.md and the authentication architecture notes.

## Testing

Existing auth unit tests cover password-only and SSO-only login. Added cases to
that suite for combined login and incomplete OIDC settings. CI runs these tests.
Browser behavior has not been manually verified yet.

## Upgrade impact

Instances with both login methods configured will show both options. Remove
incomplete OIDC settings or supply all required values before upgrading.

## Confirmation

- [x] I have read and followed the [contribution guidelines](https://github.com/Dictionarry-Hub/profilarr/blob/develop/docs/CONTRIBUTING.md).
- [x] I have reviewed this contribution, including any AI-written code or text,
      understand the changes, and can address review feedback.
- [x] The description and any claimed verification accurately reflect what
      changed and what I actually checked.
