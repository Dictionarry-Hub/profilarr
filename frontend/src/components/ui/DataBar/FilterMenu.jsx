import React, {useRef, useEffect} from 'react';
import {Filter} from 'lucide-react';

function FilterMenu({
    filterType,
    setFilterType,
    filterValue,
    setFilterValue,
    allTags
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = useRef(null);

    const options = [
        {value: 'none', label: 'No Filter'},
        {value: 'tag', label: 'Filter by Tag'},
        {value: 'date', label: 'Filter by Date'}
    ];

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hasActiveFilter = filterType !== 'none' && filterValue;

    return (
        <div className='relative' ref={dropdownRef}>
            <button
                type='button'
                className={`
          flex items-center gap-2 px-3 py-2 min-h-10 rounded-md
          border border-gray-200 dark:border-gray-700
          transition-all duration-150 ease-in-out
          group
          ${
              hasActiveFilter
                  ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-blue-500/50 hover:text-blue-500 dark:hover:border-blue-500/50 dark:hover:text-blue-400'
          }
        `}
                onClick={() => setIsOpen(!isOpen)}>
                <Filter
                    className={`w-4 h-4 transition-colors duration-200
          ${
              hasActiveFilter
                  ? ''
                  : 'group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:animate-[wiggle_0.3s_ease-in-out]'
          }
        `}
                    style={{
                        '@keyframes wiggle': {
                            '0%': {transform: 'rotate(0deg)'},
                            '25%': {transform: 'rotate(-20deg)'},
                            '75%': {transform: 'rotate(20deg)'},
                            '100%': {transform: 'rotate(0deg)'}
                        }
                    }}
                />
                <span className='text-sm font-medium hidden sm:inline'>
                    {filterType === 'none'
                        ? 'Filter'
                        : options.find(option => option.value === filterType)
                              ?.label}
                </span>
            </button>

            {isOpen && (
                <div className='absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10'>
                    <div className='py-1' role='menu'>
                        {options.map(option => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    setFilterType(option.value);
                                    setFilterValue('');
                                    setIsOpen(false);
                                }}
                                className={`
                  block w-full text-left px-4 py-2 text-sm
                  ${
                      filterType === option.value
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                `}
                                role='menuitem'>
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {filterType === 'tag' && (
                        <div className='border-t border-gray-200 dark:border-gray-700 p-2'>
                            <select
                                value={filterValue}
                                onChange={e => setFilterValue(e.target.value)}
                                className='w-full px-2 py-1.5 text-sm rounded-md
                  bg-gray-50 dark:bg-gray-700
                  text-gray-700 dark:text-gray-300
                  border border-gray-200 dark:border-gray-600
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'>
                                <option value=''>Select a tag</option>
                                {allTags.map(tag => (
                                    <option key={tag} value={tag}>
                                        {tag}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {filterType === 'date' && (
                        <div className='border-t border-gray-200 dark:border-gray-700 p-2'>
                            <input
                                type='date'
                                value={filterValue}
                                onChange={e => setFilterValue(e.target.value)}
                                className='w-full px-2 py-1.5 text-sm rounded-md
                  bg-gray-50 dark:bg-gray-700
                  text-gray-700 dark:text-gray-300
                  border border-gray-200 dark:border-gray-600
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default FilterMenu;
