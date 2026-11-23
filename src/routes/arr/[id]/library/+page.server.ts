import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';
import { deleteArrInstance } from '#server/arr_instances/service.ts';

export const actions: Actions = {
	delete: async ({ params }) => {
		const id = parseInt(params.id || '', 10);

		// An id that is not there is not an error on this page: it leads back to the list
		if (!isNaN(id)) {
			const result = await deleteArrInstance(id);
			if (!result.ok && result.kind !== 'not_found') {
				return fail(500, { error: result.message });
			}
		}

		redirect(303, '/arr');
	}
};
