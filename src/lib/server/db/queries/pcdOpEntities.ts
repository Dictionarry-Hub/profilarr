import { db } from '../db.ts';

export type OpEntityRole = 'target' | 'prerequisite';

export interface OpEntityRow {
	entity: string;
	name: string;
	previousName: string | null;
	role: OpEntityRole;
}

export interface LiveOpEntityRow extends OpEntityRow {
	opId: number;
}

interface RawRow {
	op_id: number;
	entity: string;
	name: string;
	previous_name: string | null;
	role: OpEntityRole;
}

export const pcdOpEntitiesQueries = {
	/** Call inside the transaction that creates the op. */
	insertForOp(opId: number, databaseId: number, rows: OpEntityRow[]): void {
		for (const row of rows) {
			db.execute(
				`INSERT OR IGNORE INTO pcd_op_entities
					(op_id, database_id, entity, name, previous_name, role)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				opId,
				databaseId,
				row.entity,
				row.name,
				row.previousName,
				row.role
			);
		}
	},

	listLive(databaseId: number): LiveOpEntityRow[] {
		return db
			.query<RawRow>(
				`SELECT e.op_id, e.entity, e.name, e.previous_name, e.role
				 FROM pcd_op_entities e
				 JOIN pcd_ops o ON o.id = e.op_id
				 WHERE e.database_id = ? AND o.origin = 'user' AND o.state = 'published'
				 ORDER BY COALESCE(o.sequence, o.id), o.id, e.role, e.entity, e.name`,
				databaseId
			)
			.map((r) => ({
				opId: r.op_id,
				entity: r.entity,
				name: r.name,
				previousName: r.previous_name,
				role: r.role
			}));
	},

	countUnplaced(databaseId: number): number {
		const row = db.queryFirst<{ n: number }>(
			`SELECT COUNT(*) AS n
			 FROM pcd_ops o
			 WHERE o.database_id = ? AND o.origin = 'user' AND o.state = 'published'
			   AND NOT EXISTS (
			     SELECT 1 FROM pcd_op_entities e WHERE e.op_id = o.id AND e.role = 'target'
			   )`,
			databaseId
		);
		return row?.n ?? 0;
	}
};
