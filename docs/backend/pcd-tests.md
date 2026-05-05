# PCD Tests

PCD tests cover the database-first behavior of the PCD system: writer output,
op replay, conflict detection, conflict resolution, and compiled cache state.
For the PCD system itself, see [pcd.md](./pcd.md). For entity behavior, see
[pcd-entities.md](./pcd-entities.md).

## Table of Contents

- [Purpose](#purpose)
- [Suite Layout](#suite-layout)
- [Harness](#harness)
- [Write Tests](#write-tests)
- [Conflict Tests](#conflict-tests)
- [Fixture Builders](#fixture-builders)
- [Browser Boundary](#browser-boundary)

## Purpose

PCD correctness is tested below the browser because the source of truth is the
compiled cache, not the UI. The suite verifies four contracts:

- Writer calls persist the expected `pcd_ops` rows.
- Compile replays schema, base, tweaks, and user layers into the expected cache
  state.
- Stale user guards surface conflicts according to the database instance's
  conflict strategy.
- Align and override resolution leave the compiled cache in the expected final
  state.

## Suite Layout

PCD tests live in the integration test tree:

```text
tests/integration/pcd/
  harness/
  write/
  conflicts/
```

The suite uses the shared integration harness for server lifecycle, HTTP
requests, and isolated `APP_BASE_PATH` directories. The PCD harness layers
PCD-specific setup, op seeding, writer drivers, and cache assertions on top of
that shared harness.

Tests are grouped by contract:

**Write tests** call real app entrypoints and assert the ops emitted by the
writer.

**Conflict tests** seed complete op histories and assert conflict history plus
final compiled cache state.

## Harness

The PCD harness owns the repeated setup needed by both write and conflict
tests:

- Create a minimal PCD repo on disk with `deps/schema/ops/0.schema.sql`.
- Create a `database_instances` row with configurable conflict strategy,
  enabled state, and base-write access.
- Seed published base ops, draft base ops, and published user ops.
- Trigger compile through the same app path used by integration tests.
- Query `pcd_ops`, latest `pcd_op_history`, and current conflicts.
- Read compiled cache tables in deterministic order.
- Drive writer entrypoints with a `TestClient`.
- Capture emitted ops since a checkpoint.

The harness is intentionally thin. It provides setup and assertions, but it does
not duplicate writer behavior or hide that compile consumes SQL ops.

## Write Tests

Write tests verify the writer contract for one user action at a time.

Each write test follows the same shape:

1. Create an isolated database instance and seed the smallest base state
   needed for the action (`seededPcd` does both, plus an initial compile).
2. Record an op checkpoint with `opCheckpoint(ctx)`.
3. Submit the real form action through `write.regex.*` (or the writer for
   the entity under test).
4. Query ops emitted after the checkpoint with `userOpsSince(ctx, ...)`.
5. Assert op count, metadata, desired state, grouping, generated flags, and
   SQL shape using the helpers in `harness/pcd.ts` and the colocated
   `helpers.ts` for the entity.

Example, taken from `tests/integration/pcd/write/regex/update.test.ts`:

```ts
test('scalar fields split into independent grouped ops', async () => {
	const ctx = await seededPcd('scalars', [
		base.regex({
			name: 'Scalar Regex',
			pattern: '\\bold\\b',
			description: 'Old',
			regex101Id: 'old101'
		})
	]);
	const checkpoint = opCheckpoint(ctx);

	await write.regex.update(ctx, 1, {
		name: 'Scalar Regex',
		pattern: '\\bnew\\b',
		description: 'New description',
		regex101Id: 'new101'
	});

	const ops = userOpsSince(ctx, checkpoint);
	assertEquals(ops.length, 3);
	assertOnlyField(ops, 'pattern');
	assertOnlyField(ops, 'description');
	assertOnlyField(ops, 'regex101_id');
	assertSameGroup(ops);
});
```

`seededPcd` and `userOpsSince` come from a per-entity `helpers.ts`
(`createScenarioFactory` binds the spec's port and counter). `base.regex`,
`opCheckpoint`, `assertOnlyField`, and `assertSameGroup` come from the
shared harness. Each spec file owns its port (one server boot per file)
and runs in parallel with siblings.

### Doc Comment Format

Each write test sits behind a JSDoc block with three labeled sections so the
inputs and expectations are visible without reading the body:

```ts
/**
 * Context
 *   Empty PCD (only schema seeded), compiled once.
 *
 * Submit
 *   POST /regular-expressions/{ctx.dbId}/new with form fields:
 *     name        = 'Created Regex'
 *     pattern     = '\bcreated\b'
 *     description = ''
 *     regex101Id  = ''
 *     tags        = '[]'
 *     layer       = 'user'
 *
 * Expect
 *   - userOpsSince(checkpoint).length === 1
 *   - op.metadata.operation     === 'create'
 *   - op.metadata.entity        === 'regular_expression'
 *   - op.metadata.name          === 'Created Regex'
 *   - op.desired_state.name        === 'Created Regex'
 *   - op.desired_state.pattern     === '\bcreated\b'
 *   - op.desired_state.description === null
 *   - op.desired_state.regex101_id === null
 *   - op.desired_state.tags        === []
 *   - op.sql matches /insert into "?regular_expressions"?/i
 */
test('minimal regex emits one create op', async () => {
	// ...
});
```

Section conventions:

- **Context**: seeded entities and whether compile has run. Use `Empty PCD` if
  no entities are seeded.
- **Submit**: the exact endpoint plus every form field and its value, including
  fields the harness fills with defaults. The writer sees the full request, so
  the doc shows it.
- **Expect**: assertions as code-shaped bullets so the test body reads as their
  literal expansion. Cover op count, metadata fields, desired state values, and
  SQL match patterns. Failure-path tests use `response.status` and the
  SvelteKit failure payload shape.

## Conflict Tests

Conflict tests verify replay and resolution behavior from complete op histories.
Each scenario has three inputs:

- **Base**: the original published upstream state.
- **User**: local user intent written as user ops.
- **Upstream**: newer published base ops that simulate a pull.

The same scenario runs under `ask`, `align`, and `override` when all three
strategies are meaningful. The primary assertion is final compiled cache state.
Op state and history assertions explain how the system got there.

Conflict strategy expectations:

| Strategy   | Conflict expectation                                                       | Final state expectation            |
| ---------- | -------------------------------------------------------------------------- | ---------------------------------- |
| `ask`      | conflicts remain as `conflicted_pending`                                   | upstream state plus clean user ops |
| `align`    | conflicted user ops are dropped                                            | upstream wins                      |
| `override` | conflicted user ops are superseded or dropped, replacement ops are written | user intent wins                   |

Example:

```ts
test('regex pattern conflict resolves by strategy', async () => {
	await runConflictScenario({
		base: [
			base.regex({
				name: 'TestRegex',
				pattern: '\\boriginal\\b',
				description: ''
			})
		],
		user: [
			user.regex.update('TestRegex', {
				pattern: { from: '\\boriginal\\b', to: '\\buser\\b' }
			})
		],
		upstream: [
			upstream.regex.update('TestRegex', {
				pattern: { from: '\\boriginal\\b', to: '\\bupstream\\b' }
			})
		],
		expect: {
			ask: {
				conflicts: [
					{
						entity: 'regular_expression',
						field: 'pattern',
						reason: 'guard_mismatch'
					}
				],
				state: {
					regularExpressions: [{ name: 'TestRegex', pattern: '\\bupstream\\b' }]
				}
			},
			align: {
				conflicts: [],
				state: {
					regularExpressions: [{ name: 'TestRegex', pattern: '\\bupstream\\b' }]
				}
			},
			override: {
				conflicts: [],
				state: {
					regularExpressions: [{ name: 'TestRegex', pattern: '\\buser\\b' }]
				}
			}
		}
	});
});
```

## Fixture Builders

Fixture builders remove repetitive seed SQL while preserving the op-level
contract that compile consumes. Builders emit SQL plus the metadata and desired
state needed by conflict handling.

```ts
base.regex({ name, pattern, description });
user.regex.update(name, { pattern: { from, to } });
upstream.regex.update(name, { pattern: { from, to } });
```

Raw SQL remains available for cases where a test needs exact control over the
operation. The harness does not provide a full alternate writer DSL; real writes
still go through the application writer.

## Browser Boundary

Browser tests cover browser behavior only: rendering conflict lists, selecting
resolutions, submitting forms, and displaying empty states. They do not own PCD
correctness.

Writer, compile, conflict, and final state behavior belong in integration tests.
