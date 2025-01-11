import React from 'react';
import PropTypes from 'prop-types';
import {Copy, Check} from 'lucide-react';
import Tooltip from '@ui/Tooltip';

const RegexCard = ({
    pattern,
    onEdit,
    onClone,
    formatDate,
    sortBy,
    isSelectionMode,
    isSelected,
    willBeSelected,
    onSelect
}) => {
    const totalTests = pattern.tests?.length || 0;
    const passedTests = pattern.tests?.filter(t => t.passes)?.length || 0;
    const passRate =
        totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    const handleClick = e => {
        if (isSelectionMode) {
            onSelect(e);
        } else {
            onEdit();
        }
    };

    const handleCloneClick = e => {
        e.stopPropagation();
        onClone(pattern);
    };

    const handleMouseDown = e => {
        // Prevent text selection when shift-clicking
        if (e.shiftKey) {
            e.preventDefault();
        }
    };

    return (
        <div
            className={`h-full w-full bg-white dark:bg-gray-800 border ${
                isSelected
                    ? 'border-blue-500 dark:border-blue-400'
                    : willBeSelected
                    ? 'border-blue-300 dark:border-blue-600'
                    : 'border-gray-200 dark:border-gray-700'
            } rounded-lg shadow hover:shadow-lg ${
                isSelectionMode
                    ? isSelected
                        ? 'hover:border-blue-400'
                        : 'hover:border-gray-400'
                    : 'hover:border-blue-400'
            } dark:hover:border-blue-500 transition-all cursor-pointer`}
            onClick={handleClick}
            onMouseDown={handleMouseDown}>
            <div className='flex flex-col p-6 gap-3 h-full'>
                {/* Header Section */}
                <div className='flex justify-between items-center gap-4'>
                    <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100 truncate'>
                        {pattern.name}
                    </h3>
                    <div className='w-8 h-8 flex items-center justify-center'>
                        {isSelectionMode ? (
                            <Tooltip
                                content={
                                    isSelected
                                        ? 'Selected'
                                        : willBeSelected
                                        ? 'Will be selected'
                                        : 'Select'
                                }>
                                <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                        isSelected
                                            ? 'bg-blue-500'
                                            : willBeSelected
                                            ? 'bg-blue-200 dark:bg-blue-800'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                    } transition-colors hover:bg-blue-600`}>
                                    {isSelected && (
                                        <Check
                                            size={14}
                                            className='text-white'
                                        />
                                    )}
                                    {willBeSelected && !isSelected && (
                                        <div className='w-1.5 h-1.5 rounded-full bg-blue-400' />
                                    )}
                                </div>
                            </Tooltip>
                        ) : (
                            <button
                                onClick={handleCloneClick}
                                className='w-8 h-8 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center'>
                                <Copy className='w-5 h-5 text-gray-500 dark:text-gray-400' />
                            </button>
                        )}
                    </div>
                </div>

                {/* Pattern Display */}
                <div className='bg-gray-50 dark:bg-gray-900/50 rounded-md p-3 font-mono text-sm'>
                    <code className='text-gray-800 dark:text-gray-200 break-all line-clamp-3'>
                        {pattern.pattern}
                    </code>
                </div>

                {/* Description */}
                {pattern.description && (
                    <p className='text-gray-600 dark:text-gray-300 text-sm line-clamp-2'>
                        {pattern.description}
                    </p>
                )}

                {/* Bottom Metadata */}
                <div className='flex flex-wrap items-center gap-4 text-sm mt-auto'>
                    {/* Test Results */}
                    <div className='flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md'>
                        {totalTests > 0 ? (
                            <>
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
                                    ({passedTests}/{totalTests} tests)
                                </span>
                            </>
                        ) : (
                            <span className='text-gray-500 dark:text-gray-400 text-sm'>
                                No tests
                            </span>
                        )}
                    </div>

                    {/* Tags */}
                    {pattern.tags && pattern.tags.length > 0 && (
                        <div className='flex flex-wrap gap-2 max-h-20 overflow-y-auto'>
                            {pattern.tags.map(tag => (
                                <span
                                    key={tag}
                                    className='bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded text-xs'>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Modified Date */}
                    {sortBy === 'dateModified' && pattern.modified_date && (
                        <span className='text-xs text-gray-500 dark:text-gray-400 text-left'>
                            Modified: {formatDate(pattern.modified_date)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

RegexCard.propTypes = {
    pattern: PropTypes.shape({
        name: PropTypes.string.isRequired,
        pattern: PropTypes.string.isRequired,
        description: PropTypes.string,
        tags: PropTypes.arrayOf(PropTypes.string),
        tests: PropTypes.arrayOf(
            PropTypes.shape({
                input: PropTypes.string.isRequired,
                expected: PropTypes.bool.isRequired,
                passes: PropTypes.bool.isRequired
            })
        ),
        modified_date: PropTypes.string
    }).isRequired,
    onEdit: PropTypes.func.isRequired,
    onClone: PropTypes.func.isRequired,
    formatDate: PropTypes.func.isRequired,
    sortBy: PropTypes.string.isRequired,
    isSelectionMode: PropTypes.bool.isRequired,
    isSelected: PropTypes.bool.isRequired,
    willBeSelected: PropTypes.bool,
    onSelect: PropTypes.func.isRequired
};

export default RegexCard;
