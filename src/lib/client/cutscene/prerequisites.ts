import { STAGES } from './definitions/index.ts';
import { stateChecks } from './stateChecks.ts';

export async function checkPrerequisites(
	stageIds: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
	for (const stageId of stageIds) {
		const stage = STAGES[stageId];
		if (!stage?.prerequisites) continue;

		for (const prereq of stage.prerequisites) {
			const check = stateChecks[prereq.check];
			if (!check) continue;

			const passed = await check();
			if (!passed) {
				return { ok: false, message: prereq.message };
			}
		}
	}

	return { ok: true };
}
