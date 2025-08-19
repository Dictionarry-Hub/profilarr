import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import NumberInput from '@ui/NumberInput';
import {useSorting} from '@hooks/useSorting';
import SortDropdown from '@ui/SortDropdown';
import { X } from 'lucide-react';
import { groupFormatsByTags, getGroupIcon } from '@constants/formatGroups';

const AdvancedView = ({formats, onScoreChange, onFormatRemove, showRemoveButton}) => {
    const sortOptions = [
        {label: 'Name', value: 'name'},
        {label: 'Score', value: 'score'}
    ];

    // Use the shared helper function to group formats
    const formatGroups = groupFormatsByTags(formats);

    // Create a single sort instance for all formats
    const defaultSort = {field: 'name', direction: 'asc'};
    const {sortConfig: globalSortConfig, updateSort: globalUpdateSort, sortData: globalSortData} = useSorting(defaultSort);
    
    // Pre-sort all groups using the global sort function
    const sortedGroups = useMemo(() => {
        const result = {};
        Object.entries(formatGroups)
            .filter(([_, formats]) => formats.length > 0)
            .forEach(([groupName, formats]) => {
                result[groupName] = globalSortData(formats);
            });
        return result;
    }, [formatGroups, globalSortData]);

    return (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            {Object.entries(formatGroups)
                .filter(([_, formats]) => formats.length > 0) // Only render non-empty groups
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupName, formats]) => {
                    // Use pre-sorted data from our useMemo
                    const sortedData = sortedGroups[groupName] || [];

                    return (
                        <div
                            key={groupName}
                            className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
                            <div className='px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center'>
                                <h3 className='text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center'>
                                    {getGroupIcon(groupName)}
                                    <span className='ml-2'>{groupName}</span>
                                </h3>
                                <SortDropdown
                                    sortOptions={sortOptions}
                                    currentSort={globalSortConfig}
                                    onSortChange={globalUpdateSort}
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
                                        <div className="flex items-center gap-2">
                                            <NumberInput
                                                value={format.score}
                                                onChange={value =>
                                                    onScoreChange(format.id, value)
                                                }
                                                className="w-24"
                                            />
                                            {showRemoveButton && (
                                                <button
                                                    onClick={() => onFormatRemove(format.id)}
                                                    className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 p-1"
                                                    title="Remove format"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
        </div>
    );
};

AdvancedView.propTypes = {
    formats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            score: PropTypes.number.isRequired,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    onScoreChange: PropTypes.func.isRequired,
    onFormatRemove: PropTypes.func,
    showRemoveButton: PropTypes.bool
};

AdvancedView.defaultProps = {
    onFormatRemove: () => {},
    showRemoveButton: false
};

export default AdvancedView;
