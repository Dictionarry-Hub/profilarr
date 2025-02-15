import React, {useState} from 'react';
import PropTypes from 'prop-types';
import NumberInput from '@ui/NumberInput';
import Sort from '@ui/Sort';
import {useSort} from '@hooks/useSort';
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
    Search
} from 'lucide-react';

const FormatSettings = ({formats, onScoreChange}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const sortOptions = [
        {label: 'Name', value: 'name'},
        {label: 'Score', value: 'score'}
    ];

    // Group formats by their tags
    const groupedFormats = formats.reduce((acc, format) => {
        if (!format.tags || format.tags.length === 0) {
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
        Audio: groupedFormats['Audio'] || [],
        Codecs: groupedFormats['Codec'] || [],
        Enhancements: groupedFormats['Enhancement'] || [],
        HDR: groupedFormats['HDR'] || [],
        'Indexer Flags': groupedFormats['Indexer'] || [],
        Language: groupedFormats['Language'] || [],
        'Release Groups': groupedFormats['Release Group'] || [],
        Resolution: groupedFormats['Resolution'] || [],
        Source: groupedFormats['Source'] || [],
        Storage: groupedFormats['Storage'] || [],
        'Streaming Services': groupedFormats['Streaming'] || [],
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

    // Filter formats based on search query
    const filteredGroups = Object.entries(formatGroups).reduce(
        (acc, [key, formats]) => {
            const filtered = formats.filter(format =>
                format.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            if (filtered.length > 0) {
                acc[key] = filtered;
            }
            return acc;
        },
        {}
    );

    // Create sort instances for each group
    const groupSorts = Object.entries(filteredGroups).reduce(
        (acc, [groupName, formats]) => {
            acc[groupName] = useSort({
                data: formats,
                options: sortOptions
            });
            return acc;
        },
        {}
    );

    return (
        <div className='space-y-4'>
            <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 text-gray-400 -translate-y-1/2' />
                <input
                    type='text'
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder='Search formats...'
                    className='w-full pl-10 h-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg
                   text-gray-900 dark:text-gray-100 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   transition-colors duration-200'
                />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                {Object.entries(filteredGroups)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([groupName, formats]) => {
                        const {sortedData, sort, setSort} =
                            groupSorts[groupName];

                        return (
                            <div
                                key={groupName}
                                className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
                                <div className='px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center'>
                                    <h3 className='text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center'>
                                        {getGroupIcon(groupName)}
                                        <span className='ml-2'>
                                            {groupName}
                                        </span>
                                    </h3>
                                    <Sort
                                        options={sortOptions}
                                        value={sort}
                                        onChange={setSort}
                                    />
                                </div>

                                <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                                    {sortedData.map(format => (
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
                                    ))}
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
