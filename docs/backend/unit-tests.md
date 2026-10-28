# Unit Tests

**Source:** `tests/unit/`

Unit tests call app modules directly, in-process, with no server or browser.
They run on Vitest under Node, and each test file gets its own process. For
tests that drive the built app, see [flow-tests.md](./flow-tests.md).

## Table of Contents

- [Running](#running)
- [Layout](#layout)
- [Writing a Test](#writing-a-test)
- [Assertions](#assertions)
- [Test Data, Fakes and Time](#test-data-fakes-and-time)
- [Rewriting Older Tests](#rewriting-older-tests)

## Running

```bash
deno task test                          # every unit test
deno task test unit tests/unit/auth     # one folder or file
deno task check:tests                   # type-check the tests with tsc
```

Vitest strips types without checking them, so `check:tests` does the type
check. It is part of `deno task check`. The tests in `tests/unit/pr` and
`tests/unit/release` cover Deno scripts, so they still run on `deno test`.
`deno task test` runs both.

## Layout

`tests/unit` mirrors `src/lib`, with one test file per source module:

```
src/lib/server/utils/auth/network.ts  ->  tests/unit/server/utils/auth/network.test.ts
src/lib/shared/upgrades/filters.ts    ->  tests/unit/shared/upgrades/filters.test.ts
```

There is no line limit. A test file that grows very long usually means its
module does too much, which is worth raising in review. Shared helpers,
builders and fakes live in `tests/unit/helpers/`, in a file per domain. Import
app code through the aliases (`$utils/`, `$shared/` and so on), never through
`../src/` paths.

## Writing a Test

Each file opens with a header that names the module and says what its tests
protect. Inside, each unit under test gets a `describe` block named after it,
such as a function or a class. Test names state the behaviour as a sentence,
so a report reads "evaluateRule > rejects an item whose field is false".

Every test has a comment above it with two bulleted lists. `Given` sets out the
input and state, and `Expects` lists what must be true afterwards:

```ts
/**
 * Upgrade filter evaluation.
 *
 * - Rules match only the values their operator allows.
 * - Nested groups combine their children with AND or OR.
 */

describe('evaluateRule', () => {
	/**
	 * Given:
	 * - a rule `monitored is true`
	 * - an item with `monitored: false`
	 *
	 * Expects:
	 * - `evaluateRule` returns false
	 */
	test('rejects an item whose field is false', () => {
		expect(evaluateRule({ monitored: false }, rule)).toBe(false);
	});
});
```

When one behaviour needs checking against many inputs, use a `test.for` table
instead of a loop around `test()`. Each row then shows up as its own test, and
the table reads as the specification. One comment above the table covers all
of its rows.

## Assertions

Use Vitest's `expect`:

- `toStrictEqual` for objects and arrays. Unlike `toEqual`, it fails on missing
  `undefined` keys and on a class instance compared with a plain object.
- `toBe` for strings, numbers and booleans.
- `toThrow`, or `rejects.toThrow` for promises, when an error is expected.

## Test Data, Fakes and Time

- **Builders.** Build inputs with the typed builders in `tests/unit/helpers/`.
  A builder takes `Partial` overrides, so a test only spells out the fields it
  is about. Add a builder there rather than writing a large literal inline.
- **Database.** A test that needs the app database gets its own freshly
  migrated copy. Migrations run once per file and each test starts from a copy,
  so no test depends on another's data or on the order tests run in.
- **Fakes.** Replace a dependency with a small hand-written fake, such as a
  subclass of an Arr client that returns fixed data. Fakes that more than one
  file needs go in `tests/unit/helpers/`. Don't replace modules with `vi.mock`.
  Use `vi.fn` only to record how a fake was called.
- **Time.** Control time with Vitest's fake clock (`vi.useFakeTimers` and
  `vi.setSystemTime`) instead of real waits. If a test can't avoid real time,
  for example because SQLite reads its own clock, a comment says why.

## Rewriting Older Tests

Most files predate these rules. They still use `@std/assert` and the
`BaseTest` class in `tests/unit/base/`, and they sit in area folders such as
`tests/unit/auth` that don't follow `src/lib`. They are being rewritten one
area per PR. Each rewrite moves the files to their mirrored paths and applies
the rules above.

A rewrite first works out what each old test actually checks. It adds small
missing tests and drops ones that check nothing useful. Larger gaps go in the
PR description, so they can become their own tickets. The last rewrite deletes
`BaseTest` and removes `@std/assert`.
