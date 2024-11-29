import React from 'react';
import PropTypes from 'prop-types';
import {Copy} from 'lucide-react';

const RegexCard = ({pattern, onEdit, onClone, formatDate, sortBy}) => {
    const totalTests = pattern.tests.length;
    const passedTests = pattern.tests.filter(t => t.passes).length;
    const passRate = Math.round((passedTests / totalTests) * 100);

    return (
        <div
            className='w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer max-h-96'
            onClick={() => onEdit(pattern)}>
            <div className='flex flex-col p-6 gap-3'>
                {/* Header Section */}
                <div className='flex justify-between items-center gap-4'>
                    <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100 truncate'>
                        {pattern.name}
                    </h3>
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            onClone(pattern);
                        }}
                        className='p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors shrink-0'>
                        <Copy className='w-5 h-5 text-gray-500 dark:text-gray-400' />
                    </button>
                </div>

                {/* Pattern Display with line clamp */}
                <div className='bg-gray-50 dark:bg-gray-900/50 rounded-md p-3 font-mono text-sm'>
                    <code className='text-gray-800 dark:text-gray-200 break-all line-clamp-3'>
                        {pattern.pattern}
                    </code>
                </div>

                {/* Description if exists - with line clamp */}
                {pattern.description && (
                    <p className='text-gray-600 dark:text-gray-300 text-sm line-clamp-2'>
                        {pattern.description}
                    </p>
                )}

                {/* Bottom Metadata */}
                <div className='flex flex-wrap items-center gap-4 text-sm'>
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

                    {/* Date Modified/Created */}
                    {(sortBy === 'dateModified' ||
                        sortBy === 'dateCreated') && (
                        <span className='text-xs text-gray-500 dark:text-gray-400 text-left'>
                            {sortBy === 'dateModified' ? 'Modified' : 'Created'}
                            :{' '}
                            {formatDate(
                                sortBy === 'dateModified'
                                    ? pattern.modified_date
                                    : pattern.created_date
                            )}
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
        ).isRequired,
        created_date: PropTypes.string.isRequired,
        modified_date: PropTypes.string.isRequired
    }).isRequired,
    onEdit: PropTypes.func.isRequired,
    onClone: PropTypes.func.isRequired,
    formatDate: PropTypes.func.isRequired,
    sortBy: PropTypes.string.isRequired
};

export default RegexCard;
