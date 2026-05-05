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

1. Create an isolated database instance.
2. Seed the smallest base state needed for the action.
3. Compile once so the writer sees the expected current state.
4. Record an op checkpoint.
5. Submit the real form action or API request.
6. Query ops emitted after the checkpoint.
7. Assert SQL shape, metadata, desired state, grouping, generated flags, and
   dependencies.

Example:

```ts
test('regex update writes one op per changed field', async () => {
	const pcd = await setupPcd({ strategy: 'ask' });

	await pcd.seedBase([
		base.regex({
			name: 'TestRegex',
			pattern: '\\bold\\b',
			description: 'Old'
		})
	]);

	await pcd.compile();
	const checkpoint = await pcd.ops.checkpoint();

	await pcd.write.regex.update('TestRegex', {
		pattern: '\\bnew\\b',
		description: 'New'
	});

	const ops = await pcd.ops.since(checkpoint, { origin: 'user' });

	expectOps(ops).toMatch([
		{
			entity: 'regular_expression',
			operation: 'update',
			changedFields: ['pattern'],
			desiredState: {
				pattern: { from: '\\bold\\b', to: '\\bnew\\b' }
			}
		},
		{
			entity: 'regular_expression',
			operation: 'update',
			changedFields: ['description'],
			desiredState: {
				description: { from: 'Old', to: 'New' }
			}
		}
	]);

	expectSameGroup(ops);
});
```

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

| Strategy | Conflict expectation | Final state expectation |
| -------- | -------------------- | ----------------------- |
| `ask`    | conflicts remain as `conflicted_pending` | upstream state plus clean user ops |
| `align`  | conflicted user ops are dropped | upstream wins |
| `override` | conflicted user ops are superseded or dropped, replacement ops are written | user intent wins |

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
