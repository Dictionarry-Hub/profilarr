import React from 'react';
import {
    Music,
    Tv,
    Users,
    Cloud,
    Film,
    HardDrive,
    Maximize,
    Globe,
    Video,
    Flag,
    Zap,
    Package,
    List,
    BookOpen,
    X
} from 'lucide-react';

// Format tag categories for grouping
export const FORMAT_TAG_CATEGORIES = {
    AUDIO: 'Audio',
    CODEC: 'Codec',
    EDITION: 'Edition',
    ENHANCEMENT: 'Enhancement',
    HDR: 'HDR',
    FLAG: 'Flag',
    LANGUAGE: 'Language',
    RELEASE_GROUP: 'Release Group',
    RELEASE_GROUP_TIER: 'Release Group Tier',
    RESOLUTION: 'Resolution',
    SOURCE: 'Source',
    STORAGE: 'Storage',
    STREAMING_SERVICE: 'Streaming Service'
};

// Format grouping mappings (tag to display group)
export const FORMAT_GROUP_NAMES = {
    Audio: 'Audio',
    Codecs: 'Codecs',
    Edition: 'Edition',
    Enhancements: 'Enhancements',
    HDR: 'HDR',
    'Indexer Flags': 'Indexer Flags',
    Language: 'Language',
    'Release Groups': 'Release Groups', 
    'Group Tier Lists': 'Group Tier Lists',
    Resolution: 'Resolution',
    Source: 'Source',
    Storage: 'Storage',
    'Streaming Services': 'Streaming Services',
    Uncategorized: 'Uncategorized'
};

// Icon components creation function
const createIcon = (IconComponent, size = 16) => {
    return React.createElement(IconComponent, { size });
};

// Icons for each format group
export const FORMAT_GROUP_ICONS = {
    Audio: createIcon(Music),
    HDR: createIcon(Tv),
    'Release Groups': createIcon(Users),
    'Group Tier Lists': createIcon(List),
    'Streaming Services': createIcon(Cloud),
    Codecs: createIcon(Film),
    Edition: createIcon(BookOpen),
    Storage: createIcon(HardDrive),
    Resolution: createIcon(Maximize),
    Language: createIcon(Globe),
    Source: createIcon(Video),
    'Indexer Flags': createIcon(Flag),
    Enhancements: createIcon(Zap),
    Uncategorized: createIcon(Package),
    Remove: createIcon(X)
};

// Helper function to group formats by their tags
export const groupFormatsByTags = (formats) => {
    // First group by tags
    const groupedByTags = formats.reduce((acc, format) => {
        // Check if format has any tags that match known categories
        const hasKnownTag = format.tags?.some(
            tag =>
                tag.includes(FORMAT_TAG_CATEGORIES.AUDIO) ||
                tag.includes(FORMAT_TAG_CATEGORIES.CODEC) ||
                tag.includes(FORMAT_TAG_CATEGORIES.EDITION) ||
                tag.includes(FORMAT_TAG_CATEGORIES.ENHANCEMENT) ||
                tag.includes(FORMAT_TAG_CATEGORIES.HDR) ||
                tag.includes(FORMAT_TAG_CATEGORIES.FLAG) ||
                tag.includes(FORMAT_TAG_CATEGORIES.LANGUAGE) ||
                (tag.includes(FORMAT_TAG_CATEGORIES.RELEASE_GROUP) && !tag.includes('Tier')) ||
                tag.includes(FORMAT_TAG_CATEGORIES.RELEASE_GROUP_TIER) ||
                tag.includes(FORMAT_TAG_CATEGORIES.RESOLUTION) ||
                tag.includes(FORMAT_TAG_CATEGORIES.SOURCE) ||
                tag.includes(FORMAT_TAG_CATEGORIES.STORAGE) ||
                tag.includes(FORMAT_TAG_CATEGORIES.STREAMING_SERVICE)
        );

        // Place in uncategorized if no known tags
        if (!hasKnownTag) {
            if (!acc['Uncategorized']) acc['Uncategorized'] = [];
            acc['Uncategorized'].push(format);
            return acc;
        }

        // Otherwise, place in each relevant tag category
        format.tags.forEach(tag => {
            if (!acc[tag]) acc[tag] = [];
            acc[tag].push(format);
        });
        return acc;
    }, {});

    // Then map to proper format groups
    return {
        Audio: Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.AUDIO))
            .flatMap(([_, formats]) => formats),
        Codecs: Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.CODEC))
            .flatMap(([_, formats]) => formats),
        Edition: Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.EDITION))
            .flatMap(([_, formats]) => formats),
        Enhancements: Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.ENHANCEMENT))
            .flatMap(([_, formats]) => formats),
        HDR: Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.HDR))
            .flatMap(([_, formats]) => formats),
        'Indexer Flags': Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.FLAG))
            .flatMap(([_, formats]) => formats),
        Language: Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.LANGUAGE))
            .flatMap(([_, formats]) => formats),
        'Release Groups': Object.entries(groupedByTags)
            .filter(
                ([tag]) =>
                    tag.includes(FORMAT_TAG_CATEGORIES.RELEASE_GROUP) && !tag.includes('Tier')
            )
            .flatMap(([_, formats]) => formats),
        'Group Tier Lists': Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.RELEASE_GROUP_TIER))
            .flatMap(([_, formats]) => formats),
        Resolution: Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.RESOLUTION))
            .flatMap(([_, formats]) => formats),
        Source: Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.SOURCE))
            .flatMap(([_, formats]) => formats),
        Storage: Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.STORAGE))
            .flatMap(([_, formats]) => formats),
        'Streaming Services': Object.entries(groupedByTags)
            .filter(([tag]) => tag.includes(FORMAT_TAG_CATEGORIES.STREAMING_SERVICE))
            .flatMap(([_, formats]) => formats),
        Uncategorized: groupedByTags['Uncategorized'] || []
    };
};

// Get the appropriate icon for a group name
export const getGroupIcon = (groupName) => {
    return FORMAT_GROUP_ICONS[groupName] || FORMAT_GROUP_ICONS.Uncategorized;
};