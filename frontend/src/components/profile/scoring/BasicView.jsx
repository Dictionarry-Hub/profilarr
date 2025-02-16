import React from 'react';
import PropTypes from 'prop-types';
import NumberInput from '@ui/NumberInput';
import {useSorting} from '@hooks/useSorting';
import SortDropdown from '@ui/SortDropdown';

const BasicView = ({formats, onScoreChange}) => {
    const sortOptions = [
        {label: 'Score', value: 'score'},
        {label: 'Name', value: 'name'}
    ];

    const {sortConfig, updateSort, sortData} = useSorting({
        field: 'score',
        direction: 'desc'
    });

    const sortedFormats = sortData(formats);

    return (
        <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
            <div className='px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center'>
                <h3 className='text-sm font-bold text-gray-900 dark:text-gray-100'>
                    Formats
                </h3>
                <SortDropdown
                    sortOptions={sortOptions}
                    currentSort={sortConfig}
                    onSortChange={updateSort}
                />
            </div>

            <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                {sortedFormats.length > 0 ? (
                    sortedFormats.map(format => (
                        <div
                            key={format.id}
                            className='flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 group'>
                            <div className='flex-1 min-w-0 mr-4'>
                                <div className='flex items-center gap-2'>
                                    <p className='text-sm text-gray-900 dark:text-gray-100 truncate'>
                                        {format.name}
                                    </p>
                                    {format.tags && format.tags.length > 0 && (
                                        <span className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                                            {format.tags.join(', ')}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <NumberInput
                                value={format.score}
                                onChange={value =>
                                    onScoreChange(format.id, value)
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
};

BasicView.propTypes = {
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

export default BasicView;
