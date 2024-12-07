import React, {useState, useEffect} from 'react';
import {Search, X} from 'lucide-react';

const SearchBar = ({
    onSearch,
    placeholder = 'Search...',
    value = '',
    className = ''
}) => {
    const [searchTerm, setSearchTerm] = useState(value);

    useEffect(() => {
        setSearchTerm(value);
    }, [value]);

    const handleChange = e => {
        const newValue = e.target.value;
        setSearchTerm(newValue);
        onSearch(newValue);
    };

    const clearSearch = () => {
        setSearchTerm('');
        onSearch('');
    };

    return (
        <div className={`relative flex-1 min-w-0 ${className}`}>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
            <input
                type='text'
                value={searchTerm}
                onChange={handleChange}
                placeholder={placeholder}
                className='w-full h-10 pl-9 pr-8 rounded-md border border-gray-300 
                 bg-white dark:bg-gray-800 dark:border-gray-700
                 text-gray-900 dark:text-gray-100 
                 placeholder:text-gray-500 dark:placeholder:text-gray-400
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                 transition-colors'
            />
            {searchTerm && (
                <button
                    onClick={clearSearch}
                    className='absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700'>
                    <X className='h-4 w-4 text-gray-400' />
                </button>
            )}
        </div>
    );
};

export default SearchBar;
