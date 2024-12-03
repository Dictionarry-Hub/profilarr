import React from 'react';
import PropTypes from 'prop-types';

const FormatUnitTest = ({test, onEdit, onDelete}) => {
    const getBadgeStyles = condition => {
        if (condition.required && condition.negate) {
            return {
                badge: 'bg-orange-100 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300',
                icon: 'text-orange-700 dark:text-orange-300'
            };
        }
        if (condition.required) {
            return {
                badge: 'bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300',
                icon: 'text-green-700 dark:text-green-300'
            };
        }
        if (condition.negate) {
            return {
                badge: 'bg-red-100 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300',
                icon: 'text-red-700 dark:text-red-300'
            };
        }
        return {
            badge: 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300',
            icon: 'text-blue-700 dark:text-blue-300'
        };
    };

    // New helper to determine if it's actually applying as expected
    const formatApplies = test.passes && test.expected;

    return (
        <div className='group rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden'>
            <div className='px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                    <div
                        className={`w-2 h-2 rounded-full ${
                            test.passes
                                ? 'bg-green-500 shadow-sm shadow-green-500/50'
                                : 'bg-red-500 shadow-sm shadow-red-500/50'
                        }`}
                    />
                    <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                        Format {formatApplies ? 'Applies' : 'Does Not Apply'}
                    </span>
                </div>
                <div className='flex items-center gap-4'>
                    <span className='text-xs text-gray-500 dark:text-gray-400'>
                        Last run:{' '}
                        {test.lastRun
                            ? new Date(test.lastRun).toLocaleString()
                            : 'Never'}
                    </span>
                    <div className='opacity-0 group-hover:opacity-100 transition-opacity flex gap-2'>
                        <button
                            onClick={() => onEdit(test)}
                            className='p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded'>
                            <svg
                                className='w-4 h-4 text-gray-500 dark:text-gray-400'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'>
                                <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
                                <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
                            </svg>
                        </button>
                        <button
                            onClick={() => onDelete(test.id)}
                            className='p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded'>
                            <svg
                                className='w-4 h-4 text-gray-500 dark:text-gray-400'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'>
                                <path d='M18 6L6 18M6 6l12 12' />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div className='p-4'>
                <div className='mb-3 bg-gray-50 dark:bg-gray-900/50 rounded-md p-2'>
                    <code className='text-sm font-mono text-gray-900 dark:text-gray-100'>
                        {test.input}
                    </code>
                </div>

                <div className='flex flex-wrap gap-2'>
                    {test.conditionResults.map((condition, index) => {
                        const styles = getBadgeStyles(condition);
                        const passes = condition.matches === !condition.negate;
                        return (
                            <span
                                key={index}
                                className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs border ${styles.badge}`}>
                                {passes ? (
                                    <svg
                                        viewBox='0 0 24 24'
                                        className={`w-3 h-3 ${styles.icon}`}
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='3'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'>
                                        <polyline points='20 6 9 17 4 12' />
                                    </svg>
                                ) : (
                                    <svg
                                        viewBox='0 0 24 24'
                                        className={`w-3 h-3 ${styles.icon}`}
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='3'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'>
                                        <path d='M18 6L6 18M6 6l12 12' />
                                    </svg>
                                )}
                                {condition.name}
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

FormatUnitTest.propTypes = {
    test: PropTypes.shape({
        id: PropTypes.number.isRequired,
        input: PropTypes.string.isRequired,
        passes: PropTypes.bool.isRequired,
        expected: PropTypes.bool.isRequired,
        lastRun: PropTypes.string,
        conditionResults: PropTypes.arrayOf(
            PropTypes.shape({
                name: PropTypes.string.isRequired,
                type: PropTypes.string.isRequired,
                pattern: PropTypes.string,
                required: PropTypes.bool.isRequired,
                negate: PropTypes.bool.isRequired,
                matches: PropTypes.bool.isRequired
            })
        ).isRequired
    }).isRequired,
    onEdit: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired
};

export default FormatUnitTest;
