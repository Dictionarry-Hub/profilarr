import { test } from 'vitest';
import { assertEquals } from '@std/assert';
import { Database } from '../../../src/lib/server/db/sqlite.ts';

function withDatabase(fn: (db: Database) => void) {
	const db = new Database(':memory:');
	try {
		fn(db);
	} finally {
		db.close();
	}
}

test('SQLite wrapper: whole numbers bind as integers, decimals as reals', () => {
	withDatabase((db) => {
		const type = (value: number) =>
			db.prepare('SELECT typeof(?) AS t').get<{ t: string }>(value)?.t;
		assertEquals(type(5), 'integer');
		assertEquals(type(-12), 'integer');
		assertEquals(type(2.5), 'real');
	});
});

test('SQLite wrapper: a whole number in a TEXT column stores without a decimal', () => {
	withDatabase((db) => {
		db.exec('CREATE TABLE t (s TEXT)');
		db.prepare('INSERT INTO t VALUES (?)').run(5);
		assertEquals(db.prepare('SELECT s FROM t').get(), { s: '5' });
		assertEquals(db.prepare('SELECT count(*) AS n FROM t WHERE s = ?').get('5'), { n: 1 });
	});
});

test('SQLite wrapper: SQL functions return whole numbers as integers', () => {
	withDatabase((db) => {
		db.function('seven', () => 7);
		assertEquals(db.prepare('SELECT typeof(seven()) AS t').get(), { t: 'integer' });
	});
});

test('SQLite wrapper: SQL functions keep their argument count', () => {
	withDatabase((db) => {
		db.function('nameLength', (name: string) => name.length);
		assertEquals(db.prepare("SELECT nameLength('abc') AS n").get(), { n: 3 });
	});
});

test('SQLite wrapper: double-quoted text is accepted, as with @db/sqlite', () => {
	withDatabase((db) => {
		db.exec('CREATE TABLE t (name TEXT)');
		db.exec('INSERT INTO t VALUES ("Foo")');
		assertEquals(db.prepare('SELECT name FROM t').get(), { name: 'Foo' });
	});
});

test('SQLite wrapper: booleans bind as 1 and 0', () => {
	withDatabase((db) => {
		assertEquals(db.prepare('SELECT ? AS yes, ? AS no').get(true, false), { yes: 1, no: 0 });
	});
});

test('SQLite wrapper: dates bind as ISO text', () => {
	withDatabase((db) => {
		const date = new Date('2026-10-28T01:22:00.000Z');
		assertEquals(db.prepare('SELECT ? AS d').get(date), { d: '2026-10-28T01:22:00.000Z' });
	});
});

test('SQLite wrapper: objects and lists bind as JSON text', () => {
	withDatabase((db) => {
		// An object or list in the first position holds the parameters, so they go later
		assertEquals(db.prepare('SELECT ? AS s, ? AS o, ? AS l').get('first', { a: 1 }, ['x', 2]), {
			s: 'first',
			o: '{"a":1}',
			l: '["x",2]'
		});
	});
});

test('SQLite wrapper: undefined binds as NULL', () => {
	withDatabase((db) => {
		assertEquals(db.prepare('SELECT ? AS v').get(undefined), { v: null });
	});
});

test('SQLite wrapper: a list in the first position holds the parameters', () => {
	withDatabase((db) => {
		assertEquals(db.prepare('SELECT ? AS a, ? AS b').get(['x', 2]), { a: 'x', b: 2 });
	});
});

test('SQLite wrapper: an object in the first position holds named parameters', () => {
	withDatabase((db) => {
		assertEquals(db.prepare('SELECT :name AS n, :count AS c').get({ name: 'x', count: 2 }), {
			n: 'x',
			c: 2
		});
	});
});
