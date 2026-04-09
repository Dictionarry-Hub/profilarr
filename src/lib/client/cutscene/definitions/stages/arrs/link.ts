import type { Stage } from '$cutscene/types.ts';

export const arrLinkStage: Stage = {
	id: 'arr-link',
	name: 'Link',
	description: 'Connect a Radarr or Sonarr instance',
	steps: [
		{
			id: 'arr-explain',
			target: 'nav-arrs',
			title: 'Arrs',
			body: "Now let's connect an Arr instance. Arrs are your Radarr and Sonarr instances that Profilarr manages. Once connected, you can push configurations directly to them. Click Arrs to continue.",
			position: 'right',
			completion: { type: 'click' }
		},
		{
			id: 'arr-add',
			route: '/arr',
			target: 'arr-add',
			title: 'Add an Instance',
			body: 'Click here to start connecting a new Arr instance.',
			position: 'below-left',
			completion: { type: 'click' }
		},
		{
			id: 'arr-type',
			route: '/arr/new',
			target: 'arr-type',
			title: 'Instance Type',
			body: 'First, select whether this is a Radarr (movies) or Sonarr (TV shows) instance.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'arr-connection',
			target: 'arr-connection',
			title: 'Connection Details',
			body: "Give your instance a name, enter its URL, and paste the API key. You can find the API key in your Arr's Settings > General page. If you're running both Profilarr and your Arr in Docker, use the container name as the host (e.g. http://radarr:7878).",
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'arr-save',
			target: 'arr-save',
			title: 'Save',
			body: "Once you've filled in the connection details, hit Save to connect the instance. Profilarr will verify the connection and add it to your setup.",
			position: 'below-left',
			completion: { type: 'manual' }
		}
	]
};
