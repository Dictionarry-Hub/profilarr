import {
    Plus, // for add
    Sparkles, // for create
    Wrench, // for tweak
    Trash, // for remove
    Bug, // for fix
    Code, // for regex
    FileJson, // for format
    Settings // for profile
} from 'lucide-react';

export const COMMIT_TYPES = [
    {
        value: 'create',
        label: 'Create',
        description: 'Building entirely new components or systems',
        icon: Sparkles,
        bg: 'bg-green-500/10',
        text: 'text-green-400'
    },
    {
        value: 'add',
        label: 'Add',
        description: 'Adding entries to existing systems',
        icon: Plus,
        bg: 'bg-blue-500/10',
        text: 'text-blue-400'
    },
    {
        value: 'tweak',
        label: 'Tweak',
        description: 'Fine-tuning and adjustments to existing components',
        icon: Wrench,
        bg: 'bg-amber-500/10',
        text: 'text-amber-400'
    },
    {
        value: 'remove',
        label: 'Remove',
        description: 'Removing components or features from the system',
        icon: Trash,
        bg: 'bg-red-500/10',
        text: 'text-red-400'
    },
    {
        value: 'fix',
        label: 'Fix',
        description: 'Corrections and bug fixes',
        icon: Bug,
        bg: 'bg-purple-500/10',
        text: 'text-purple-400'
    }
];

export const FILE_TYPES = {
    'Regex Pattern': {
        bg: 'bg-green-500/10',
        text: 'text-green-400',
        icon: Code
    },
    'Custom Format': {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        icon: FileJson
    },
    'Quality Profile': {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        icon: Settings
    }
};

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
