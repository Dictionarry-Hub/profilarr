import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {Search} from 'lucide-react';
import {SortDropdown} from '../ui/DataBar/SortDropdown';
import TabViewer from '../ui/TabViewer';

const ProfileScoringTab = ({
    formats,
    formatFilter,
    onFormatFilterChange,
    onScoreChange,
    formatSortKey,
    formatSortDirection,
    onFormatSort,
    tags,
    tagFilter,
    onTagFilterChange,
    tagScores,
    onTagScoreChange,
    tagSortKey,
    tagSortDirection,
    onTagSort,
    minCustomFormatScore,
    upgradeUntilScore,
    minScoreIncrement,
    onMinScoreChange,
    onUpgradeUntilScoreChange,
    onMinIncrementChange
}) => {
    const [activeTab, setActiveTab] = useState('formats');
    const [localFormatScores, setLocalFormatScores] = useState({});
    const [localTagScores, setLocalTagScores] = useState({});

    const tabs = [
        {id: 'formats', label: 'Format Scoring'},
        {id: 'tags', label: 'Tag Scoring'},
        {id: 'upgrades', label: 'Upgrades'}
    ];

    // Filter formats based on search
    const filteredFormats = formats.filter(format =>
        format.name.toLowerCase().includes(formatFilter.toLowerCase())
    );

    // Filter tags based on search
    const filteredTags = tags.filter(tag =>
        tag.toLowerCase().includes(tagFilter.toLowerCase())
    );

    // Handle local score changes
    const handleFormatScoreChange = (id, value) => {
        setLocalFormatScores(prev => ({...prev, [id]: value}));
    };

    const handleTagScoreChange = (tag, value) => {
        setLocalTagScores(prev => ({...prev, [tag]: value}));
    };

    // Handle blur events
    const handleFormatBlur = (id, currentScore) => {
        const localValue = localFormatScores[id];
        if (localValue === undefined) return;
        const numValue = localValue === '' ? 0 : parseInt(localValue);
        if (numValue !== currentScore) {
            onScoreChange(id, numValue);
        }
        setLocalFormatScores(prev => {
            const newState = {...prev};
            delete newState[id];
            return newState;
        });
    };

    const handleTagBlur = tag => {
        const localValue = localTagScores[tag];
        if (localValue === undefined) return;
        const currentScore = tagScores[tag] ?? 0; // Use nullish coalescing
        const numValue = localValue === '' ? 0 : parseInt(localValue);
        if (numValue !== currentScore) {
            onTagScoreChange(tag, numValue);
        }
        setLocalTagScores(prev => {
            const newState = {...prev};
            delete newState[tag];
            return newState;
        });
    };

    // Sort formats
    const sortedFormats = [...filteredFormats].sort((a, b) => {
        if (formatSortKey === 'name') {
            return formatSortDirection === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
        } else if (formatSortKey === 'score') {
            return formatSortDirection === 'asc'
                ? a.score - b.score
                : b.score - a.score;
        }
        return 0;
    });

    // Sort tags
    const sortedTags = [...filteredTags].sort((a, b) => {
        if (tagSortKey === 'name') {
            return tagSortDirection === 'asc'
                ? a.localeCompare(b)
                : b.localeCompare(a);
        } else if (tagSortKey === 'score') {
            return tagSortDirection === 'asc'
                ? (tagScores[a] || 0) - (tagScores[b] || 0)
                : (tagScores[b] || 0) - (tagScores[a] || 0);
        }
        return 0;
    });

    // Handle keydown to submit on enter
    const handleKeyDown = e => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'formats':
                return (
                    <>
                        <div className='flex items-center gap-2'>
                            <div className='flex-1 relative'>
                                <Search className='absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400' />
                                <input
                                    type='text'
                                    value={formatFilter}
                                    onChange={e =>
                                        onFormatFilterChange(e.target.value)
                                    }
                                    placeholder='Search formats...'
                                    className='w-full pl-8 pr-3 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                />
                            </div>
                            <SortDropdown
                                options={[
                                    {key: 'name', label: 'Name'},
                                    {key: 'score', label: 'Score'}
                                ]}
                                currentKey={formatSortKey}
                                currentDirection={formatSortDirection}
                                onSort={onFormatSort}
                            />
                        </div>
                        <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
                            <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                                {sortedFormats.length === 0 ? (
                                    <div className='p-3 text-center text-xs text-gray-500'>
                                        No formats found
                                    </div>
                                ) : (
                                    sortedFormats.map(format => (
                                        <div
                                            key={format.id}
                                            className='flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                                            <div className='flex items-center gap-2 min-w-0'>
                                                <span className='text-xs font-medium truncate'>
                                                    {format.name}
                                                </span>
                                                <div className='flex gap-1'>
                                                    {format.tags?.map(tag => (
                                                        <span
                                                            key={tag}
                                                            className='px-1.5 py-0.5 text-[10px] rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'>
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <input
                                                type='number'
                                                value={
                                                    localFormatScores[
                                                        format.id
                                                    ] !== undefined
                                                        ? localFormatScores[
                                                              format.id
                                                          ]
                                                        : format.score
                                                }
                                                onChange={e =>
                                                    handleFormatScoreChange(
                                                        format.id,
                                                        e.target.value
                                                    )
                                                }
                                                onBlur={() =>
                                                    handleFormatBlur(
                                                        format.id,
                                                        format.score
                                                    )
                                                }
                                                onKeyDown={handleKeyDown}
                                                className='w-20 px-3 py-1 text-sm rounded border border-gray-700 dark:bg-gray-800 dark:text-gray-100 bg-gray-800 text-gray-100 [appearance:textfield]'
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                );
            case 'tags':
                return (
                    <>
                        <div className='flex items-center gap-2'>
                            <div className='flex-1 relative'>
                                <Search className='absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400' />
                                <input
                                    type='text'
                                    value={tagFilter}
                                    onChange={e =>
                                        onTagFilterChange(e.target.value)
                                    }
                                    placeholder='Search tags...'
                                    className='w-full pl-8 pr-3 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                />
                            </div>
                            <SortDropdown
                                options={[
                                    {key: 'name', label: 'Name'},
                                    {key: 'score', label: 'Score'}
                                ]}
                                currentKey={tagSortKey}
                                currentDirection={tagSortDirection}
                                onSort={onTagSort}
                            />
                        </div>
                        <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
                            <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                                {sortedTags.length === 0 ? (
                                    <div className='p-3 text-center text-xs text-gray-500'>
                                        No tags found
                                    </div>
                                ) : (
                                    sortedTags.map(tag => (
                                        <div
                                            key={tag}
                                            className='flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50'>
                                            <span className='text-xs'>
                                                {tag}
                                            </span>
                                            <input
                                                type='number'
                                                value={
                                                    localTagScores[tag] !==
                                                    undefined
                                                        ? localTagScores[tag]
                                                        : tagScores[tag] || 0
                                                }
                                                onChange={e =>
                                                    handleTagScoreChange(
                                                        tag,
                                                        e.target.value
                                                    )
                                                }
                                                onBlur={() =>
                                                    handleTagBlur(tag)
                                                }
                                                onKeyDown={handleKeyDown}
                                                className='w-20 px-3 py-1 text-sm rounded border border-gray-700 dark:bg-gray-800 dark:text-gray-100 bg-gray-800 text-gray-100 [appearance:textfield]'
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                );
            case 'upgrades':
                return (
                    <div className='space-y-6 bg-white dark:bg-gray-800 rounded-lg p-3'>
                        <div className='divide-y divide-gray-200 dark:divide-gray-700 space-y-4'>
                            {/* Minimum Custom Format Score */}
                            <div className='pt-4 first:pt-0'>
                                <div className='flex items-center justify-between'>
                                    <div className='space-y-1'>
                                        <div className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                                            Minimum Custom Format Score
                                        </div>
                                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                                            Minimum custom format score allowed
                                            to download
                                        </p>
                                    </div>
                                    <input
                                        type='number'
                                        value={minCustomFormatScore}
                                        onChange={e =>
                                            onMinScoreChange(
                                                Number(e.target.value)
                                            )
                                        }
                                        className='w-20 px-3 py-1 text-sm rounded border border-gray-700 dark:bg-gray-800 dark:text-gray-100 bg-gray-800 text-gray-100 [appearance:textfield]'
                                    />
                                </div>
                            </div>

                            {/* Upgrade Until Score */}
                            <div className='pt-4'>
                                <div className='flex items-center justify-between'>
                                    <div className='space-y-1'>
                                        <div className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                                            Upgrade Until Custom Format Score
                                        </div>
                                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                                            Once the quality cutoff is met or
                                            exceeded and this custom format
                                            score is reached, no more upgrades
                                            will be grabbed
                                        </p>
                                    </div>
                                    <input
                                        type='number'
                                        value={upgradeUntilScore}
                                        onChange={e =>
                                            onUpgradeUntilScoreChange(
                                                Number(e.target.value)
                                            )
                                        }
                                        className='w-20 px-3 py-1 text-sm rounded border border-gray-700 dark:bg-gray-800 dark:text-gray-100 bg-gray-800 text-gray-100 [appearance:textfield]'
                                    />
                                </div>
                            </div>

                            {/* Minimum Score Increment */}
                            <div className='pt-4'>
                                <div className='flex items-center justify-between'>
                                    <div className='space-y-1'>
                                        <div className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                                            Minimum Custom Format Score
                                            Increment
                                        </div>
                                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                                            Minimum required improvement of the
                                            custom format score between existing
                                            and new releases before considering
                                            an upgrade
                                        </p>
                                    </div>
                                    <input
                                        type='number'
                                        value={minScoreIncrement}
                                        onChange={e =>
                                            onMinIncrementChange(
                                                Number(e.target.value)
                                            )
                                        }
                                        className='w-20 px-3 py-1 text-sm rounded border border-gray-700 dark:bg-gray-800 dark:text-gray-100 bg-gray-800 text-gray-100 [appearance:textfield]'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className='w-full space-y-4'>
            {/* Tab Navigation */}
            <div className='flex items-center'>
                <TabViewer
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </div>

            {/* Content Area */}
            {renderContent()}
        </div>
    );
};

ProfileScoringTab.propTypes = {
    formats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired, // Ensure id is required
            name: PropTypes.string.isRequired,
            score: PropTypes.number.isRequired,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    formatFilter: PropTypes.string.isRequired,
    onFormatFilterChange: PropTypes.func.isRequired,
    onScoreChange: PropTypes.func.isRequired,
    formatSortKey: PropTypes.string.isRequired,
    formatSortDirection: PropTypes.string.isRequired,
    onFormatSort: PropTypes.func.isRequired,
    tags: PropTypes.arrayOf(PropTypes.string).isRequired,
    tagFilter: PropTypes.string.isRequired,
    onTagFilterChange: PropTypes.func.isRequired,
    tagScores: PropTypes.object.isRequired,
    onTagScoreChange: PropTypes.func.isRequired,
    tagSortKey: PropTypes.string.isRequired,
    tagSortDirection: PropTypes.string.isRequired,
    onTagSort: PropTypes.func.isRequired,
    minCustomFormatScore: PropTypes.number.isRequired,
    upgradeUntilScore: PropTypes.number.isRequired,
    minScoreIncrement: PropTypes.number.isRequired,
    onMinScoreChange: PropTypes.func.isRequired,
    onUpgradeUntilScoreChange: PropTypes.func.isRequired,
    onMinIncrementChange: PropTypes.func.isRequired
};

export default ProfileScoringTab;
