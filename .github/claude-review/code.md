## Your review: code

Question: does this PR introduce any major problems?

Read the changed code in context, not just the diff. Use the relevant docs in `pr-head/docs/` (start at `ARCHITECTURE.md`) to understand how the affected subsystem is meant to work.

Only report:

- `bug`: behavior that's wrong for real inputs (e.g. crashes, wrong results, skipped work, swallowed errors).
- `data_loss`: data that can be lost, corrupted, or overwritten (e.g. migrations, user ops, sync deleting things it shouldn't).
- `security`: auth bypass, secret exposure, injection, or unsafe handling of untrusted input.
- `breaking_change`: existing setups, config, or public API clients that stop working after upgrading.

Don't report style, naming, formatting, or type issues (CI checks those), refactoring ideas, or problems you can't tie to a concrete scenario. Each finding should say what goes wrong and when.

Status:

- `no_issues`: none of the above.
- `issues`: one finding per problem, most severe first.
