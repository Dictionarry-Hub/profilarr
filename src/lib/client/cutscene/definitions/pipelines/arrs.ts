import type { Pipeline } from '../../types.ts';

export const arrsPipeline: Pipeline = {
	id: 'arrs',
	name: 'Arr Instances',
	description: 'Learn how to connect and manage an Arr instance',
	stages: [
		'arr-link',
		'arr-manage'
		// 'arr-sync',
		// 'arr-upgrades',
		// 'arr-renames',
	]
};
