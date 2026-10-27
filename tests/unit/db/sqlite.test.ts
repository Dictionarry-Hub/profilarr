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

Deno.test('SQLite wrapper: whole numbers bind as integers, decimals as reals', () => {
	withDatabase((db) => {
		const type = (value: number) =>
			db.prepare('SELECT typeof(?) AS t').get<{ t: string }>(value)?.t;
		assertEquals(type(5), 'integer');
		assertEquals(type(-12), 'integer');
		assertEquals(type(2.5), 'real');
	});
});

Deno.test('SQLite wrapper: a whole number in a TEXT column stores without a decimal', () => {
	withDatabase((db) => {
		db.exec('CREATE TABLE t (s TEXT)');
		db.prepare('INSERT INTO t VALUES (?)').run(5);
		assertEquals(db.prepare('SELECT s FROM t').get(), { s: '5' });
		assertEquals(db.prepare('SELECT count(*) AS n FROM t WHERE s = ?').get('5'), { n: 1 });
	});
});

Deno.test('SQLite wrapper: SQL functions return whole numbers as integers', () => {
	withDatabase((db) => {
		db.function('seven', () => 7);
		assertEquals(db.prepare('SELECT typeof(seven()) AS t').get(), { t: 'integer' });
	});
});

Deno.test('SQLite wrapper: SQL functions keep their argument count', () => {
	withDatabase((db) => {
		db.function('nameLength', (name: string) => name.length);
		assertEquals(db.prepare("SELECT nameLength('abc') AS n").get(), { n: 3 });
	});
});

Deno.test('SQLite wrapper: double-quoted text is accepted, as with @db/sqlite', () => {
	withDatabase((db) => {
		db.exec('CREATE TABLE t (name TEXT)');
		db.exec('INSERT INTO t VALUES ("Foo")');
		assertEquals(db.prepare('SELECT name FROM t').get(), { name: 'Foo' });
	});
});
