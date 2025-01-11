import React, {useState, useEffect} from 'react';
import {Search, X} from 'lucide-react';

const SearchBar = ({
    placeholder = 'Search...',
    className = '',
    requireEnter = true,
    searchTerms = [],
    currentInput = '',
    onInputChange,
    onAddTerm,
    onRemoveTerm,
    onClearTerms
}) => {
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        const handleKeyDown = e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.querySelector('input[type="text"]')?.focus();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                onClearTerms();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClearTerms]);

    const handleKeyPress = e => {
        if (requireEnter && e.key === 'Enter' && currentInput.trim()) {
            onAddTerm(currentInput);
        }
    };

    return (
        <div className={`relative flex-1 min-w-0 group ${className}`}>
            <Search
                className={`
                    absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 
                    transition-colors duration-200
                    ${
                        isFocused
                            ? 'text-blue-500'
                            : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                    }
                `}
            />

            <div
                className={`
                    w-full min-h-10 pl-9 pr-8 rounded-md
                    transition-all duration-200 ease-in-out
                    border shadow-sm flex items-center flex-wrap gap-2 p-2
                    ${
                        isFocused
                            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white/5'
                            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                    }
                    bg-white dark:bg-gray-800
                `}>
                {searchTerms.map((term, index) => (
                    <div
                        key={index}
                        className='flex items-center gap-1.5 px-2 py-1 
                            bg-blue-500/10 dark:bg-blue-500/20 
                            border border-blue-500/20 dark:border-blue-400/20
                            text-blue-600 dark:text-blue-400 
                            rounded-md shadow-sm
                            hover:bg-blue-500/15 dark:hover:bg-blue-500/25
                            hover:border-blue-500/30 dark:hover:border-blue-400/30
                            group/badge
                            transition-all duration-200'>
                        <span className='text-sm font-medium leading-none'>
                            {term}
                        </span>
                        <button
                            onClick={() => onRemoveTerm(term)}
                            className='p-0.5 hover:bg-blue-500/20 
                                rounded-sm transition-colors
                                opacity-70 group-hover/badge:opacity-100'
                            aria-label={`Remove ${term} filter`}>
                            <X className='h-3 w-3' />
                        </button>
                    </div>
                ))}
                <input
                    type='text'
                    value={currentInput}
                    onChange={e => onInputChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={
                        searchTerms.length
                            ? 'Add another filter...'
                            : placeholder
                    }
                    className='flex-1 min-w-[200px] bg-transparent 
                        text-gray-900 dark:text-gray-100
                        placeholder:text-gray-500 dark:placeholder:text-gray-400
                        focus:outline-none'
                />
            </div>

            {(searchTerms.length > 0 || currentInput) && (
                <button
                    onClick={onClearTerms}
                    className='absolute right-3 top-1/2 -translate-y-1/2 
                        p-1.5 rounded-full 
                        text-gray-400 hover:text-gray-600
                        hover:bg-gray-100 dark:hover:bg-gray-700
                        transition-all duration-200
                        group/clear'
                    aria-label='Clear all searches'>
                    <X className='h-4 w-4' />
                </button>
            )}
        </div>
    );
};

export default SearchBar;
