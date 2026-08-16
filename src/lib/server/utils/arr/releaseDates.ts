import { dateSortValue } from '$shared/utils/sort.ts';
import type { RadarrMovie } from './types.ts';

export function resolveRadarrInitialReleaseDate(movie: RadarrMovie): string | undefined {
	if (dateSortValue(movie.inCinemas) !== null) {
		return movie.inCinemas;
	}

	const digital = dateSortValue(movie.digitalRelease);
	const physical = dateSortValue(movie.physicalRelease);

	if (digital === null && physical === null) return undefined;
	if (digital !== null && physical !== null && digital === physical) {
		return movie.digitalRelease;
	}
	if (digital !== null && (physical === null || digital < physical)) {
		return movie.digitalRelease;
	}

	return movie.physicalRelease;
}
