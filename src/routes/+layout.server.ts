import type { LayoutServerLoad } from './$types';
import { appInfoQueries } from '$db/queries/appInfo.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { isParserHealthy } from '$lib/server/utils/arr/parser/client.ts';
import { onboardingQueries } from '$db/queries/onboarding.ts';
import { FEATURES } from '$lib/shared/features.ts';
import { dev } from '$app/environment';

export const load: LayoutServerLoad = async () => {
	const arrInstances = arrInstancesQueries.getAll().map((i) => ({
		id: i.id,
		name: i.name,
		type: i.type
	}));

	const databases = databaseInstancesQueries.getAll().map((d) => ({
		id: d.id,
		name: d.name
	}));

	return {
		version: appInfoQueries.getVersion(),
		arrInstances,
		databases,
		parserAvailable: await isParserHealthy(),
		onboardingShown: FEATURES.cutscene || dev ? onboardingQueries.getShown() : true
	};
};
