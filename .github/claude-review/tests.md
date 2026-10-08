## Your review: tests

Tests are in `pr-head/tests/` (unit, integration, e2e). CI runs them from `pr-head/.github/workflows/`.

Question: do the existing test suites cover the behavior this PR changes?

Use the PR description's "Testing" section as context, but judge the tests themselves. You can't run tests or see CI results; judge whether the tests exist and exercise the change, not whether they pass.

Status:

- `not_applicable`: the change has no testable behavior (e.g. docs-only, copy, or purely visual changes).
- `covered`: tests exercise the changed behavior. List them in `covered_by`.
- `gaps`: some changed behavior has no test, or a test named in the description doesn't exercise it. Add a finding for each, pointing at the untested code.

Only consider the project's existing suites. Never suggest new frameworks, one-off scripts, or other tools. Contributors aren't required to add tests, so a gap is information for the maintainer, not a failure.
