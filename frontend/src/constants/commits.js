export const COMMIT_TYPES = [
    {
        value: 'create',
        label: 'Create',
        description: 'Building entirely new components or systems'
    },
    {
        value: 'add',
        label: 'Add',
        description: 'Adding entries to existing systems'
    },
    {
        value: 'tweak',
        label: 'Tweak',
        description: 'Fine-tuning and adjustments to existing components'
    },
    {
        value: 'fix',
        label: 'Fix',
        description: 'Corrections and bug fixes'
    }
];

export const COMMIT_SCOPES = [
    {
        value: 'regex',
        label: 'Regex Pattern',
        description: 'Changes related to regex patterns'
    },
    {
        value: 'format',
        label: 'Custom Format',
        description: 'Changes related to custom formats'
    },
    {
        value: 'profile',
        label: 'Quality Profile',
        description: 'Changes related to quality profiles'
    }
];
