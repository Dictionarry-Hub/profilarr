import React from 'react';
import PropTypes from 'prop-types';
import NumberInput from '@ui/NumberInput';
import {useSorting} from '@hooks/useSorting';
import SortDropdown from '@ui/SortDropdown';
import SearchBar from '@ui/DataBar/SearchBar';
import useSearch from '@hooks/useSearch';
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
    Package
} from 'lucide-react';

const FormatSettings = ({formats, onScoreChange}) => {
    const sortOptions = [
        {label: 'Name', value: 'name'},
        {label: 'Score', value: 'score'}
    ];

    const {
        searchTerms,
        currentInput,
        setCurrentInput,
        addSearchTerm,
        removeSearchTerm,
        clearSearchTerms,
        items: filteredFormats
    } = useSearch(formats, {
        searchableFields: ['name']
    });

    // Group formats by their tags
    const groupedFormats = filteredFormats.reduce((acc, format) => {
        // Check if format has any tags that match our known categories
        const hasKnownTag = format.tags?.some(
            tag =>
                tag.includes('Audio') ||
                tag.includes('Codec') ||
                tag.includes('Enhancement') ||
                tag.includes('HDR') ||
                tag.includes('Flag') ||
                tag.includes('Language') ||
                tag.includes('Release Group') ||
                tag.includes('Resolution') ||
                tag.includes('Source') ||
                tag.includes('Storage') ||
                tag.includes('Streaming Service')
        );

        if (!hasKnownTag) {
            if (!acc['Uncategorized']) acc['Uncategorized'] = [];
            acc['Uncategorized'].push(format);
            return acc;
        }

        format.tags.forEach(tag => {
            if (!acc[tag]) acc[tag] = [];
            acc[tag].push(format);
        });
        return acc;
    }, {});

    const formatGroups = {
        Audio: Object.entries(groupedFormats)
            .filter(([tag]) => tag.includes('Audio'))
            .flatMap(([_, formats]) => formats),
        Codecs: Object.entries(groupedFormats)
            .filter(([tag]) => tag.includes('Codec'))
            .flatMap(([_, formats]) => formats),
        Enhancements: Object.entries(groupedFormats)
            .filter(([tag]) => tag.includes('Enhancement'))
            .flatMap(([_, formats]) => formats),
        HDR: Object.entries(groupedFormats)
            .filter(([tag]) => tag.includes('HDR'))
            .flatMap(([_, formats]) => formats),
        'Indexer Flags': Object.entries(groupedFormats)
            .filter(([tag]) => tag.includes('Flag'))
            .flatMap(([_, formats]) => formats),
        Language: Object.entries(groupedFormats)
            .filter(([tag]) => tag.includes('Language'))
            .flatMap(([_, formats]) => formats),
        'Release Groups': Object.entries(groupedFormats)
            .filter(([tag]) => tag.includes('Release Group'))
            .flatMap(([_, formats]) => formats),
        Resolution: Object.entries(groupedFormats)
            .filter(([tag]) => tag.includes('Resolution'))
            .flatMap(([_, formats]) => formats),
        Source: Object.entries(groupedFormats)
            .filter(([tag]) => tag.includes('Source'))
            .flatMap(([_, formats]) => formats),
        Storage: Object.entries(groupedFormats)
            .filter(([tag]) => tag.includes('Storage'))
            .flatMap(([_, formats]) => formats),
        'Streaming Services': Object.entries(groupedFormats)
            .filter(([tag]) => tag.includes('Streaming Service'))
            .flatMap(([_, formats]) => formats),
        Uncategorized: groupedFormats['Uncategorized'] || []
    };

    const getGroupIcon = groupName => {
        const icons = {
            Audio: <Music size={16} />,
            HDR: <Tv size={16} />,
            'Release Groups': <Users size={16} />,
            'Streaming Services': <Cloud size={16} />,
            Codecs: <Film size={16} />,
            Storage: <HardDrive size={16} />,
            Resolution: <Maximize size={16} />,
            Language: <Globe size={16} />,
            Source: <Video size={16} />,
            'Indexer Flags': <Flag size={16} />,
            Enhancements: <Zap size={16} />,
            Uncategorized: <Package size={16} />
        };
        return icons[groupName] || <Package size={16} />;
    };

    // Create sort instances for each group
    const groupSorts = Object.entries(formatGroups).reduce(
        (acc, [groupName, formats]) => {
            const defaultSort = {field: 'name', direction: 'desc'};
            const {sortConfig, updateSort, sortData} = useSorting(defaultSort);

            acc[groupName] = {
                sortedData: sortData(formats),
                sortConfig,
                updateSort
            };
            return acc;
        },
        {}
    );

    return (
        <div className='space-y-3'>
            <SearchBar
                placeholder='Search formats...'
                searchTerms={searchTerms}
                currentInput={currentInput}
                onInputChange={setCurrentInput}
                onAddTerm={addSearchTerm}
                onRemoveTerm={removeSearchTerm}
                onClearTerms={clearSearchTerms}
            />

            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                {Object.entries(formatGroups)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([groupName, formats]) => {
                        const {sortedData, sortConfig, updateSort} =
                            groupSorts[groupName];

                        return (
                            <div
                                key={groupName}
                                className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
                                <div className='px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center'>
                                    <h3 className='text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center'>
                                        {getGroupIcon(groupName)}
                                        <span className='ml-2'>
                                            {groupName}
                                        </span>
                                    </h3>
                                    <SortDropdown
                                        sortOptions={sortOptions}
                                        currentSort={sortConfig}
                                        onSortChange={updateSort}
                                    />
                                </div>

                                <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                                    {sortedData.length > 0 ? (
                                        sortedData.map(format => (
                                            <div
                                                key={format.id}
                                                className='flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 group'>
                                                <div className='flex-1 min-w-0 mr-4'>
                                                    <p className='text-sm text-gray-900 dark:text-gray-100 truncate'>
                                                        {format.name}
                                                    </p>
                                                </div>
                                                <NumberInput
                                                    value={format.score}
                                                    onChange={value =>
                                                        onScoreChange(
                                                            format.id,
                                                            value
                                                        )
                                                    }
                                                />
                                            </div>
                                        ))
                                    ) : (
                                        <div className='px-4 py-3 text-sm text-gray-500 dark:text-gray-400'>
                                            No formats found
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
};

FormatSettings.propTypes = {
    formats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            score: PropTypes.number.isRequired,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    onScoreChange: PropTypes.func.isRequired
};

export default FormatSettings;
