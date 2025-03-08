import React, {useEffect, useRef, useState, useCallback} from 'react';
import PropTypes from 'prop-types';
import {ChevronDown, Check, Search} from 'lucide-react';
import SearchBar from './DataBar/SearchBar';
import SortDropdown from './SortDropdown';
import useSearch from '@hooks/useSearch';
import {useSorting} from '@hooks/useSorting';

const SearchDropdown = ({
    value,
    onChange,
    options,
    placeholder,
    className,
    width = 'w-full',
    dropdownWidth,
    labelKey = 'label',
    valueKey = 'value',
    searchableFields = ['label', 'description']
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState(
        options.find(opt => opt[valueKey] === value) || null
    );

    const dropdownRef = useRef(null);
    const menuRef = useRef(null);

    const {
        searchTerms,
        currentInput,
        setCurrentInput,
        addSearchTerm,
        removeSearchTerm,
        clearSearchTerms,
        items: filteredOptions
    } = useSearch(options, {
        searchableFields,
        initialSortBy: 'label'
    });

    const {sortConfig, updateSort, sortData} = useSorting({
        field: 'label',
        direction: 'asc'
    });

    // Sort options configuration for the dropdown (name only)
    const sortOptions = [{value: 'label', label: 'Name (A-Z)'}];

    // Update selected option when value changes externally
    useEffect(() => {
        setSelectedOption(options.find(opt => opt[valueKey] === value) || null);
    }, [value, options, valueKey]);

    // Handle dropdown visibility
    useEffect(() => {
        // Handle clicks outside dropdown (close the dropdown)
        const handleClickOutside = event => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Apply final sorting to the filtered results
    const sortedOptions = useCallback(() => {
        // Separate special and regular items
        const specialItems = filteredOptions.filter(item => item.isSpecial);
        const regularItems = filteredOptions.filter(item => !item.isSpecial);
        
        // Sort each group separately
        const sortedSpecialItems = [...specialItems].sort((a, b) => 
            sortConfig.direction === 'asc'
                ? a[sortConfig.field].localeCompare(b[sortConfig.field])
                : b[sortConfig.field].localeCompare(a[sortConfig.field])
        );
        
        const sortedRegularItems = [...regularItems].sort((a, b) => 
            sortConfig.direction === 'asc'
                ? a[sortConfig.field].localeCompare(b[sortConfig.field])
                : b[sortConfig.field].localeCompare(a[sortConfig.field])
        );
        
        // We're adding a divider dynamically in the render based on the transition from special to regular items
        
        // Combine the two sorted arrays
        return [...sortedSpecialItems, ...sortedRegularItems];
    }, [filteredOptions, sortConfig]);

    // Handle selection
    const handleSelect = useCallback(
        option => {
            setSelectedOption(option);
            onChange({target: {value: option[valueKey]}});
            setIsOpen(false);
        },
        [onChange, valueKey]
    );

    return (
        <div className={`relative ${width}`} ref={dropdownRef}>
            {/* Selected Value Button */}
            <button
                type='button'
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm 
                border rounded-md
                bg-gray-700 border-gray-600 text-gray-100 hover:border-gray-500 
                focus:outline-none focus:ring-2 focus:ring-blue-500 
                transition-colors ${className}`}>
                <span className='truncate'>
                    {selectedOption
                        ? selectedOption[labelKey]
                        : placeholder || 'Select option...'}
                </span>
                <ChevronDown
                    className={`w-4 h-4 ml-2 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    ref={menuRef}
                    className='absolute z-50 mt-1 
                        bg-gray-800 border border-gray-700 rounded-md shadow-lg 
                        flex flex-col overflow-hidden'
                    style={{
                        width: dropdownWidth || '650px',
                        maxHeight: '700px',
                        left: '0'
                    }}>
                    <div className='p-3 bg-gray-800 shadow-sm relative'>
                        <div className='absolute left-0 right-0 bottom-0 h-px bg-gray-700/50'></div>
                        <div className='flex items-center gap-2'>
                            <div className='flex-grow'>
                                <SearchBar
                                    placeholder='Search options...'
                                    searchTerms={searchTerms}
                                    currentInput={currentInput}
                                    onInputChange={setCurrentInput}
                                    onAddTerm={addSearchTerm}
                                    onRemoveTerm={removeSearchTerm}
                                    onClearTerms={clearSearchTerms}
                                    requireEnter={true}
                                    textSize='text-xs'
                                    badgeTextSize='text-xs'
                                    iconSize='h-3.5 w-3.5'
                                    minHeight='h-8'
                                />
                            </div>
                            <SortDropdown
                                sortOptions={sortOptions}
                                currentSort={sortConfig}
                                onSortChange={updateSort}
                                className='flex-shrink-0'
                                textSize='text-xs'
                                menuTextSize='text-xs'
                                iconSize={14}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className='flex-1 p-2 pt-3 overflow-auto'>
                        {sortedOptions().length > 0 ? (
                            <div className='flex flex-col'>
                                {sortedOptions().map((option, index, array) => (
                                    <React.Fragment key={option[valueKey]}>
                                        {/* Add a divider after the last special item */}
                                        {index > 0 && 
                                         !option.isSpecial && 
                                         array[index-1].isSpecial && (
                                            <div className="h-px bg-gray-600/80 mx-2 my-2"></div>
                                        )}
                                    
                                        <div
                                            onClick={() => handleSelect(option)}
                                            className={`px-2.5 py-1.5 text-xs cursor-pointer rounded 
                                                ${
                                                    selectedOption?.[valueKey] ===
                                                    option[valueKey]
                                                        ? 'bg-blue-600 text-white'
                                                        : option.isSpecial
                                                        ? 'text-blue-300 hover:bg-gray-700/70 font-medium'
                                                        : 'text-gray-100 hover:bg-gray-700'
                                                }
                                                `}>
                                        <div className='flex items-center'>
                                            <div className='flex-grow truncate'>
                                                {option[labelKey]}
                                            </div>
                                            {selectedOption?.[valueKey] ===
                                                option[valueKey] && (
                                                <Check className='w-3.5 h-3.5 ml-1.5 flex-shrink-0' />
                                            )}
                                        </div>
                                    </div>
                                    </React.Fragment>
                                ))}
                            </div>
                        ) : (
                            <div className='px-3 py-12 text-center'>
                                <div className='bg-gray-700/30 rounded-lg p-4 max-w-xs mx-auto'>
                                    <Search className='w-6 h-6 mb-2 mx-auto text-gray-500 opacity-40' />
                                    <p className='text-gray-300 text-xs'>
                                        No options match your search
                                    </p>
                                    <button
                                        onClick={clearSearchTerms}
                                        className='mt-2 text-xs text-blue-400 hover:underline'>
                                        Clear search
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

SearchDropdown.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
            description: PropTypes.string
        })
    ).isRequired,
    placeholder: PropTypes.string,
    className: PropTypes.string,
    width: PropTypes.string,
    dropdownWidth: PropTypes.string,
    labelKey: PropTypes.string,
    valueKey: PropTypes.string,
    searchableFields: PropTypes.arrayOf(PropTypes.string)
};

export default SearchDropdown;
