import type { ArrDelayProfile } from '$arr/types.ts';
import type { DelayProfilesRow } from '$shared/pcd/display.ts';

export function transformDelayProfile(profile: DelayProfilesRow): ArrDelayProfile {
	let enableUsenet = true;
	let enableTorrent = true;
	let preferredProtocol = 'usenet';

	switch (profile.preferred_protocol) {
		case 'prefer_usenet':
			enableUsenet = true;
			enableTorrent = true;
			preferredProtocol = 'usenet';
			break;
		case 'prefer_torrent':
			enableUsenet = true;
			enableTorrent = true;
			preferredProtocol = 'torrent';
			break;
		case 'only_usenet':
			enableUsenet = true;
			enableTorrent = false;
			preferredProtocol = 'usenet';
			break;
		case 'only_torrent':
			enableUsenet = false;
			enableTorrent = true;
			preferredProtocol = 'torrent';
			break;
	}

	return {
		id: 1,
		enableUsenet,
		enableTorrent,
		preferredProtocol,
		usenetDelay: profile.usenet_delay ?? 0,
		torrentDelay: profile.torrent_delay ?? 0,
		bypassIfHighestQuality: profile.bypass_if_highest_quality,
		bypassIfAboveCustomFormatScore: profile.bypass_if_above_custom_format_score,
		minimumCustomFormatScore: profile.minimum_custom_format_score ?? 0,
		order: 2147483647,
		tags: []
	};
}
