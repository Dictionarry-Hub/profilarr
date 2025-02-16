import React, {useState} from 'react';
import PropTypes from 'prop-types';
import SearchBar from '@ui/DataBar/SearchBar';
import useSearch from '@hooks/useSearch';
import AdvancedView from './AdvancedView';
import BasicView from './BasicView';
import {ChevronDown, Settings, List} from 'lucide-react';

const FormatSettings = ({formats, onScoreChange}) => {
    const [isAdvancedView, setIsAdvancedView] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const {
        searchTerms,
        currentInput,
        setCurrentInput,
        addSearchTerm,
        removeSearchTerm,
        clearSearchTerms,
        items: filteredFormats
    } = useSearch(formats, {
        searchableFields: ['name']
    });

    return (
        <div className='space-y-3'>
            <div className='flex gap-3'>
                <SearchBar
                    className='flex-1'
                    placeholder='Search formats...'
                    searchTerms={searchTerms}
                    currentInput={currentInput}
                    onInputChange={setCurrentInput}
                    onAddTerm={addSearchTerm}
                    onRemoveTerm={removeSearchTerm}
                    onClearTerms={clearSearchTerms}
                />

                <div className='relative flex'>
                    <button
                        onClick={() => setIsDropdownOpen(prev => !prev)}
                        className='inline-flex items-center justify-between w-36 px-3 py-2 rounded-md border border-gray-300 bg-white hover:border-gray-400 transition-colors dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600'
                        aria-expanded={isDropdownOpen}
                        aria-haspopup='true'>
                        <span className='flex items-center gap-2'>
                            {isAdvancedView ? (
                                <>
                                    <Settings
                                        size={16}
                                        className='text-gray-500 dark:text-gray-400'
                                    />
                                    <span className='text-sm font-medium'>
                                        Advanced
                                    </span>
                                </>
                            ) : (
                                <>
                                    <List
                                        size={16}
                                        className='text-gray-500 dark:text-gray-400'
                                    />
                                    <span className='text-sm font-medium'>
                                        Basic
                                    </span>
                                </>
                            )}
                        </span>
                        <ChevronDown
                            size={16}
                            className={`text-gray-500 dark:text-gray-400 transition-transform ${
                                isDropdownOpen ? 'transform rotate-180' : ''
                            }`}
                        />
                    </button>
                    {isDropdownOpen && (
                        <>
                            <div
                                className='fixed inset-0'
                                onClick={() => setIsDropdownOpen(false)}
                            />
                            <div className='absolute right-0 mt-12 w-36 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-10'>
                                <div>
                                    <button
                                        onClick={() => {
                                            setIsAdvancedView(false);
                                            setIsDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm ${
                                            !isAdvancedView
                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        }`}>
                                        <div className='flex items-center gap-2'>
                                            <List size={16} />
                                            <span>Basic</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsAdvancedView(true);
                                            setIsDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm ${
                                            isAdvancedView
                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        }`}>
                                        <div className='flex items-center gap-2'>
                                            <Settings size={16} />
                                            <span>Advanced</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {isAdvancedView ? (
                <AdvancedView
                    formats={filteredFormats}
                    onScoreChange={onScoreChange}
                />
            ) : (
                <BasicView
                    formats={filteredFormats}
                    onScoreChange={onScoreChange}
                />
            )}
        </div>
    );
};

FormatSettings.propTypes = {
    formats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            score: PropTypes.number.isRequired,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    onScoreChange: PropTypes.func.isRequired
};

export default FormatSettings;
