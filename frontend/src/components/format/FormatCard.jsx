import React from 'react';
import PropTypes from 'prop-types';
import {Copy} from 'lucide-react';

function FormatCard({
    format,
    onEdit,
    onClone,
    sortBy,
    isSelectionMode,
    isSelected,
    onSelect
}) {
    const {content} = format;
    const totalTests = content.tests?.length || 0;
    const passedTests = content.tests?.filter(t => t.passes)?.length || 0;
    const passRate = Math.round((passedTests / totalTests) * 100) || 0;

    const getConditionStyle = condition => {
        if (condition.required && condition.negate) {
            return 'bg-orange-100 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300';
        }
        if (condition.required) {
            return 'bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300';
        }
        if (condition.negate) {
            return 'bg-red-100 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300';
        }
        return 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300';
    };

    const getDisplayConditions = conditions => {
        if (!conditions?.length) return [];

        // Sort conditions: required first, then non-required
        const sortedConditions = [...conditions].sort((a, b) => {
            if (a.required && !b.required) return -1;
            if (!a.required && b.required) return 1;
            return 0;
        });

        if (sortedConditions.length <= 5) return sortedConditions;

        // Take first 4 conditions and add a count of remaining ones
        const displayConditions = sortedConditions.slice(0, 4);
        const remainingCount = sortedConditions.length - 4;

        // Add a virtual condition for the count
        displayConditions.push({
            name: `+${remainingCount} more...`,
            isCounter: true
        });

        return displayConditions;
    };

    const handleClick = e => {
        if (isSelectionMode) {
            onSelect(e);
        } else {
            onEdit();
        }
    };

    const handleCloneClick = e => {
        e.stopPropagation();
        if (!isSelectionMode) {
            onClone(format);
        }
    };

    return (
        <div
            className={`w-full bg-white dark:bg-gray-800 border ${
                isSelected
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700'
            } rounded-lg shadow hover:shadow-lg ${
                isSelectionMode
                    ? isSelected
                        ? 'hover:border-blue-500'
                        : 'hover:border-gray-400'
                    : 'hover:border-blue-400'
            } dark:hover:border-blue-500 transition-all cursor-pointer max-h-96`}
            onClick={handleClick}>
            <div className='flex flex-col p-6 gap-3'>
                {/* Header Section */}
                <div className='flex justify-between items-start gap-4'>
                    <div className='flex-1'>
                        <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100 truncate'>
                            {content.name}
                        </h3>
                        {(sortBy === 'dateModified' ||
                            sortBy === 'dateCreated') && (
                            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                                {sortBy === 'dateModified'
                                    ? 'Modified'
                                    : 'Created'}
                                :{' '}
                                {new Date(
                                    sortBy === 'dateModified'
                                        ? format.modified_date
                                        : format.created_date
                                ).toLocaleString()}
                            </p>
                        )}
                    </div>
                    <button
                        className={`p-2 rounded-full transition-colors ${
                            isSelectionMode
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        onClick={handleCloneClick}
                        disabled={isSelectionMode}>
                        <Copy className='w-5 h-5 text-gray-500 dark:text-gray-400' />
                    </button>
                </div>

                {content.description && (
                    <p className='text-gray-600 dark:text-gray-300 text-sm line-clamp-2'>
                        {content.description}
                    </p>
                )}

                <div className='flex justify-between items-start gap-4'>
                    <div className='flex flex-wrap gap-2 flex-1'>
                        {getDisplayConditions(content.conditions)?.map(
                            (condition, index) => (
                                <span
                                    key={index}
                                    className={`px-2 py-1 rounded text-xs font-medium ${
                                        condition.isCounter
                                            ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                            : getConditionStyle(condition)
                                    }`}>
                                    {condition.name}
                                </span>
                            )
                        )}
                    </div>

                    {totalTests > 0 && (
                        <div className='flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded shrink-0'>
                            <span
                                className={`text-sm font-medium ${
                                    passRate === 100
                                        ? 'text-green-600 dark:text-green-400'
                                        : passRate >= 80
                                        ? 'text-yellow-600 dark:text-yellow-400'
                                        : 'text-red-600 dark:text-red-400'
                                }`}>
                                {passRate}% Pass Rate
                            </span>
                            <span className='text-gray-500 dark:text-gray-400 text-xs'>
                                ({passedTests}/{totalTests})
                            </span>
                        </div>
                    )}
                </div>

                {content.tags?.length > 0 && (
                    <div className='flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700'>
                        {content.tags.map(tag => (
                            <span
                                key={tag}
                                className='bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-1 rounded text-xs'>
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

FormatCard.propTypes = {
    format: PropTypes.shape({
        file_name: PropTypes.string.isRequired,
        modified_date: PropTypes.string.isRequired,
        created_date: PropTypes.string.isRequired,
        content: PropTypes.shape({
            name: PropTypes.string.isRequired,
            description: PropTypes.string,
            conditions: PropTypes.arrayOf(
                PropTypes.shape({
                    name: PropTypes.string.isRequired,
                    type: PropTypes.string.isRequired,
                    pattern: PropTypes.string,
                    required: PropTypes.bool,
                    negate: PropTypes.bool
                })
            ),
            tags: PropTypes.arrayOf(PropTypes.string),
            tests: PropTypes.arrayOf(
                PropTypes.shape({
                    id: PropTypes.number.isRequired,
                    input: PropTypes.string.isRequired,
                    expected: PropTypes.bool.isRequired,
                    passes: PropTypes.bool.isRequired
                })
            )
        }).isRequired
    }).isRequired,
    onEdit: PropTypes.func.isRequired,
    onClone: PropTypes.func.isRequired,
    sortBy: PropTypes.string.isRequired,
    isSelectionMode: PropTypes.bool.isRequired,
    isSelected: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired
};

export default FormatCard;
