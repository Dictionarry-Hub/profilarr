import React from 'react';
import {ArrowDownUp} from 'lucide-react';

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
                className='flex items-center gap-2 px-3 py-2 min-h-10 rounded-md
          border border-gray-200 dark:border-gray-700
          bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 
          hover:bg-gray-50 dark:hover:bg-gray-750
          hover:border-blue-500/50 hover:text-blue-500
          dark:hover:border-blue-500/50 dark:hover:text-blue-400
          transition-all duration-150 ease-in-out
          group'>
                <ArrowDownUp
                    className='w-4 h-4 transition-all duration-200 
          [transform-style:preserve-3d]
          group-hover:[transform:rotateX(180deg)]
          group-hover:text-blue-500 dark:group-hover:text-blue-400'
                />
                <span className='text-sm font-medium hidden sm:inline'>Sort</span>
            </button>

            {isOpen && (
                <div
                    className='absolute right-0 mt-2 w-56 py-1
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          rounded-md shadow-lg z-10'>
                    {options.map(option => (
                        <button
                            key={option.key}
                            onClick={() => handleSort(option.key)}
                            className='flex items-center justify-between w-full px-4 py-2 text-sm
                text-gray-700 dark:text-gray-300
                hover:bg-blue-50 dark:hover:bg-blue-900/20
                hover:text-blue-500 dark:hover:text-blue-400
                transition-colors duration-150'>
                            <span>{option.label}</span>
                            {currentKey === option.key && (
                                <span className='text-blue-500 dark:text-blue-400'>
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

export default SortDropdown;
