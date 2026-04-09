import { STAGES } from './definitions/index.ts';
import { stateChecks } from './stateChecks.ts';

export async function checkPrerequisites(
	stageId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
	const stage = STAGES[stageId];
	if (!stage?.prerequisites) return { ok: true };

	for (const prereq of stage.prerequisites) {
		const check = stateChecks[prereq.check];
		if (!check) continue;

		const passed = await check();
		if (!passed) {
			return { ok: false, message: prereq.message };
		}
	}

	return { ok: true };
}
