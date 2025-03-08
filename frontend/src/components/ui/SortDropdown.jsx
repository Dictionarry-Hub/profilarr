// SortDropdown.jsx

import React, {useState} from 'react';
import {ArrowDown, ArrowUp} from 'lucide-react';

const SortDropdown = ({
    sortOptions,
    currentSort,
    onSortChange,
    className = '',
    textSize = 'text-sm', // Default text size
    menuTextSize = 'text-xs', // Default menu text size
    iconSize = 16 // Default icon size
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleDropdown = () => setIsOpen(prev => !prev);

    const handleSortClick = field => {
        onSortChange(field);
        setIsOpen(false);
    };

    const getCurrentSortLabel = () => {
        const option = sortOptions.find(opt => opt.value === currentSort.field);
        return option ? option.label : 'Sort by';
    };

    return (
        <div className={`relative inline-block text-left ${className}`}>
            <button
                type='button'
                onClick={toggleDropdown}
                className={`
          inline-flex items-center justify-between
          px-4 py-2 ${textSize}
          bg-white dark:bg-gray-800
          border border-gray-300 dark:border-gray-700
          text-gray-900 dark:text-gray-100
          rounded-md
          hover:bg-gray-50 dark:hover:bg-gray-700
          focus:outline-none focus:ring-2 focus:ring-blue-500
          transition-all
        `}>
                <span className='flex items-center gap-2'>
                    {getCurrentSortLabel()}
                    {currentSort.direction === 'asc' ? (
                        <ArrowUp size={iconSize} />
                    ) : (
                        <ArrowDown size={iconSize} />
                    )}
                </span>
            </button>

            {isOpen && (
                <div
                    className='
            absolute right-0 z-10 w-56 mt-2 origin-top-right
            bg-white dark:bg-gray-800
            border border-gray-200 dark:border-gray-700
            rounded-md shadow-lg
          '>
                    <div className='py-1'>
                        {sortOptions.map(option => (
                            <button
                                key={option.value}
                                type='button'
                                onClick={() => handleSortClick(option.value)}
                                className={`
                  flex items-center justify-between w-full px-4 py-2
                  ${menuTextSize} text-gray-700 dark:text-gray-200
                  hover:bg-gray-50 dark:hover:bg-gray-700
                `}>
                                <span>{option.label}</span>
                                {currentSort.field === option.value &&
                                    (currentSort.direction === 'asc' ? (
                                        <ArrowUp size={iconSize} />
                                    ) : (
                                        <ArrowDown size={iconSize} />
                                    ))}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SortDropdown;
