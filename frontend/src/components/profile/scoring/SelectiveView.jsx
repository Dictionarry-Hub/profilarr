import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import NumberInput from '@ui/NumberInput';
import { useSorting } from '@hooks/useSorting';
import SortDropdown from '@ui/SortDropdown';
import { Plus, X } from 'lucide-react';

const SelectiveView = ({ formats, onScoreChange, allFormats }) => {
    const [selectedFormats, setSelectedFormats] = useState([]);
    const [availableFormats, setAvailableFormats] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchInput, setSearchInput] = useState('');

    const sortOptions = [
        { label: 'Score', value: 'score' },
        { label: 'Name', value: 'name' }
    ];

    const { sortConfig, updateSort, sortData } = useSorting({
        field: 'score',
        direction: 'desc'
    });

    // Initialize selected formats from the formats prop
    useEffect(() => {
        setSelectedFormats(formats);
        
        // Set available formats (those not already selected)
        updateAvailableFormats(formats);
        
        // Save selected format IDs to localStorage
        const selectedIds = formats.map(f => f.id);
        localStorage.setItem('selectedFormatsList', JSON.stringify(selectedIds));
    }, [formats, allFormats]);

    // Update available formats list (excluding already selected ones)
    const updateAvailableFormats = (selectedFormats) => {
        const selectedIds = selectedFormats.map(f => f.id);
        setAvailableFormats(allFormats.filter(f => !selectedIds.includes(f.id)));
    };

    // Add a format to the selected list
    const addFormat = (format) => {
        // Always start with score 0 for newly added formats
        const formatWithScore = {...format, score: 0};
        const newSelectedFormats = [...selectedFormats, formatWithScore];
        setSelectedFormats(newSelectedFormats);
        updateAvailableFormats(newSelectedFormats);
        setDropdownOpen(false);
        setSearchInput('');
        
        // Update the localStorage list of selected formats
        const selectedIds = newSelectedFormats.map(f => f.id);
        localStorage.setItem('selectedFormatsList', JSON.stringify(selectedIds));
        
        // Notify parent component about the new format
        onScoreChange(format.id, 0);
    };

    // Remove a format from the selected list
    const removeFormat = (formatId) => {
        const newSelectedFormats = selectedFormats.filter(f => f.id !== formatId);
        setSelectedFormats(newSelectedFormats);
        updateAvailableFormats(newSelectedFormats);
        
        // Update the localStorage list of selected formats
        const selectedIds = newSelectedFormats.map(f => f.id);
        localStorage.setItem('selectedFormatsList', JSON.stringify(selectedIds));
        
        // Also notify parent component that this format is no longer used
        onScoreChange(formatId, 0);
    };

    // Filter available formats based on search input
    const filteredAvailableFormats = availableFormats.filter(format => 
        format.name.toLowerCase().includes(searchInput.toLowerCase())
    );

    const sortedFormats = sortData(selectedFormats);

    return (
        <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
            <div className='px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center'>
                <h3 className='text-sm font-bold text-gray-900 dark:text-gray-100'>
                    Selected Formats
                </h3>
                <div className='flex gap-2'>
                    <SortDropdown
                        sortOptions={sortOptions}
                        currentSort={sortConfig}
                        onSortChange={updateSort}
                    />
                </div>
            </div>

            <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                {/* Add new format button */}
                <div className='relative'>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className='w-full flex items-center justify-center px-4 py-2 text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    >
                        <Plus size={16} className='mr-2' />
                        <span>Add Format</span>
                    </button>

                    {/* Dropdown for selecting a format to add */}
                    {dropdownOpen && (
                        <>
                            <div
                                className='fixed inset-0 z-10'
                                onClick={() => setDropdownOpen(false)}
                            />
                            <div className='absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg'>
                                <div className='p-2'>
                                    <input
                                        type='text'
                                        placeholder='Search formats...'
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        className='w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-gray-300'
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className='divide-y divide-gray-200 dark:divide-gray-700'>
                                    {filteredAvailableFormats.length > 0 ? (
                                        filteredAvailableFormats.map(format => (
                                            <button
                                                key={format.id}
                                                className='w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm'
                                                onClick={() => addFormat(format)}
                                            >
                                                <div className='flex items-center gap-2'>
                                                    <p className='text-gray-900 dark:text-gray-100 truncate'>
                                                        {format.name}
                                                    </p>
                                                    {format.tags && format.tags.length > 0 && (
                                                        <span className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                                                            {format.tags.join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className='px-4 py-3 text-sm text-gray-500 dark:text-gray-400'>
                                            No formats available
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* List of selected formats */}
                {sortedFormats.length > 0 ? (
                    sortedFormats.map(format => (
                        <div
                            key={format.id}
                            className='flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 group'
                        >
                            <div className='flex-1 min-w-0 mr-4'>
                                <div className='flex items-center gap-2'>
                                    <p className='text-sm text-gray-900 dark:text-gray-100 truncate'>
                                        {format.name}
                                    </p>
                                    {format.tags && format.tags.length > 0 && (
                                        <span className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                                            {format.tags.join(', ')}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className='flex items-center gap-2'>
                                <NumberInput
                                    value={format.score}
                                    onChange={value => onScoreChange(format.id, value)}
                                />
                                <button 
                                    onClick={() => removeFormat(format.id)}
                                    className='text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400'
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className='px-4 py-3 text-sm text-gray-500 dark:text-gray-400'>
                        No formats selected
                    </div>
                )}
            </div>
        </div>
    );
};

SelectiveView.propTypes = {
    formats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            score: PropTypes.number.isRequired,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    onScoreChange: PropTypes.func.isRequired,
    allFormats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            score: PropTypes.number.isRequired,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired
};

export default SelectiveView;