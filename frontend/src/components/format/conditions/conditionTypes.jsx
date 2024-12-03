import ReleaseTitleCondition from './ReleaseTitleCondition';
import ReleaseGroupCondition from './ReleaseGroupCondition';
import EditionCondition from './EditionCondition';
import LanguageCondition from './LanguageCondition';
import IndexerFlagCondition from './IndexerFlagCondition';
import SourceCondition from './SourceCondition';
import ResolutionCondition from './ResolutionCondition';
import QualityModifierCondition from './QualityModifierCondition';
import SizeCondition from './SizeCondition';
import ReleaseTypeCondition from './ReleaseTypeCondition';
import YearCondition from './YearCondition';

// Base condition fields that all conditions have
const baseCondition = {
    name: '',
    type: '',
    required: false,
    negate: false
};

// Type-specific condition creators
const conditionCreators = {
    release_title: () => ({
        ...baseCondition,
        pattern: ''
    }),

    release_group: () => ({
        ...baseCondition,
        pattern: ''
    }),

    edition: () => ({
        ...baseCondition,
        pattern: ''
    }),

    language: () => ({
        ...baseCondition,
        language: '',
        exceptLanguage: false
    }),

    indexer_flag: () => ({
        ...baseCondition,
        flag: ''
    }),

    source: () => ({
        ...baseCondition,
        source: ''
    }),

    resolution: () => ({
        ...baseCondition,
        resolution: ''
    }),

    quality_modifier: () => ({
        ...baseCondition,
        qualityModifier: ''
    }),

    size: () => ({
        ...baseCondition,
        minSize: '',
        maxSize: '',
        minSizeUnit: 'GB',
        maxSizeUnit: 'GB'
    }),

    release_type: () => ({
        ...baseCondition,
        releaseType: ''
    }),

    year: () => ({
        ...baseCondition,
        minYear: '',
        maxYear: ''
    })
};

export const CONDITION_TYPES = {
    RELEASE_TITLE: {
        id: 'release_title',
        name: 'Release Title',
        description: 'Match against the release title using a regex pattern',
        component: ReleaseTitleCondition
    },
    RELEASE_GROUP: {
        id: 'release_group',
        name: 'Release Group',
        description: 'Match against the release group using a regex pattern',
        component: ReleaseGroupCondition
    },
    EDITION: {
        id: 'edition',
        name: 'Edition (Radarr Only)',
        description: 'Match against the edition using a regex pattern',
        component: EditionCondition
    },
    LANGUAGE: {
        id: 'language',
        name: 'Language',
        description:
            'Match if any detected language matches the selected language',
        component: LanguageCondition
    },
    INDEXER_FLAG: {
        id: 'indexer_flag',
        name: 'Indexer Flag',
        description: 'Select an indexer-specific flag for matching',
        component: IndexerFlagCondition
    },
    SOURCE: {
        id: 'source',
        name: 'Source',
        description: 'Match against the source type of the media release',
        component: SourceCondition
    },
    RESOLUTION: {
        id: 'resolution',
        name: 'Resolution',
        description: 'Match against the resolution of the media release',
        component: ResolutionCondition
    },
    QUALITY_MODIFIER: {
        id: 'quality_modifier',
        name: 'Quality Modifier (Radarr Only)',
        description: 'Match against specific quality modifiers for Radarr',
        component: QualityModifierCondition
    },
    SIZE: {
        id: 'size',
        name: 'Size',
        description: 'Specify a size range for the media',
        component: SizeCondition
    },
    RELEASE_TYPE: {
        id: 'release_type',
        name: 'Release Type (Sonarr Only)',
        description: 'Specify the release type for Sonarr',
        component: ReleaseTypeCondition
    },
    YEAR: {
        id: 'year',
        name: 'Year (Radarr Only)',
        description: 'Specify a range of years for Radarr',
        component: YearCondition
    }
};

export const createCondition = (type = '') => {
    const creator = conditionCreators[type] || (() => ({...baseCondition}));
    const condition = creator();
    if (type) condition.type = type;
    return condition;
};
