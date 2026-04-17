import type { Stage } from '$cutscene/types.ts';

export const delayGeneralStage: Stage = {
	id: 'delay-general',
	name: 'General',
	description: 'Name, protocol preference, delays, and bypass conditions for a delay profile',
	prerequisites: [
		{
			check: 'hasDatabase',
			message:
				'You need at least one connected database to start this stage. Follow the "Link" stage under Databases from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'delay-general-intro',
			route: { resolve: 'firstDelayProfileGeneral' },
			title: 'Delay Profiles',
			body: 'A delay profile tells Radarr and Sonarr to wait before grabbing a release, which gives better copies time to appear. New content tends to land in waves: a poorly named scene WEB-DL without streaming service tags often shows up first, while cleaner releases from preferred groups with proper tags arrive later. Without a delay your *arr grabs the first release that meets your profile and then re-downloads every upgrade that lands, wasting bandwidth and storage on marginal improvements. This stage walks through the fields that make up a delay profile.',
			completion: { type: 'manual' }
		},
		{
			id: 'delay-general-name',
			target: 'delay-general-name',
			title: 'Name',
			body: 'The name identifies this delay profile when you assign it to tags inside Radarr or Sonarr. Keep it descriptive (for example "Standard 1 Hour" or "Anime Next Day") so you know which rule applies where.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'delay-general-protocol',
			target: 'delay-general-protocol',
			title: 'Protocol Preference',
			body: 'Decides which protocol your *arr favors when both have a matching release. "Prefer" modes wait the full delay and fall back to the other protocol if nothing shows up on the preferred side, while "Only" modes ignore the non-preferred protocol entirely. Pick an "Only" mode when you run a single backend and do not want the other side considered at all.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'delay-general-delays',
			target: 'delay-general-delays',
			title: 'Delays',
			body: 'How long (in minutes) to wait for each protocol before committing to a grab. A longer wait gives slower release groups time to post their polished versions instead of your *arr jumping on the first thing that meets your profile. Set either side to 0 if you want releases on that protocol to download immediately.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'delay-general-bypass',
			target: 'delay-general-bypass',
			title: 'Bypass Conditions',
			body: 'Escape hatches that skip the wait when they fire. "Highest Quality" bypasses the delay once a release already sits at the top of the linked quality profile, since nothing better is coming. "Above Custom Format Score" bypasses the delay once a release clears the minimum CF score, which is useful when you trust high scores to indicate a release you are happy to grab on sight.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'delay-general-summary',
			title: 'Summary',
			body: 'Name, protocol preference, delays, and bypass conditions make up a delay profile. Together they tell your *arr to wait a set window per protocol before grabbing, unless a bypass condition says the release is already worth jumping on.',
			completion: { type: 'manual' }
		}
	]
};
