import React from 'react';
import PropTypes from 'prop-types';
import {ArrowDown} from 'lucide-react';

export const SortDropdown = ({
    options,
    currentKey,
    currentDirection,
    onSort
}) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const handleSort = key => {
        if (key === currentKey) {
            onSort(key, currentDirection === 'asc' ? 'desc' : 'asc');
        } else {
            onSort(key, 'desc');
        }
        setIsOpen(false);
    };

    return (
        <div className='relative'>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className='flex items-center space-x-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'>
                <span>Sort</span>
                <ArrowDown size={14} />
            </button>
            {isOpen && (
                <div className='absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-10'>
                    {options.map(option => (
                        <button
                            key={option.key}
                            onClick={() => handleSort(option.key)}
                            className='block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'>
                            {option.label}
                            {currentKey === option.key && (
                                <span className='float-right'>
                                    {currentDirection === 'asc' ? '↑' : '↓'}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

SortDropdown.propTypes = {
    options: PropTypes.arrayOf(
        PropTypes.shape({
            key: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired
        })
    ).isRequired,
    currentKey: PropTypes.string.isRequired,
    currentDirection: PropTypes.string.isRequired,
    onSort: PropTypes.func.isRequired
};
