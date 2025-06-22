import React, {useState, useEffect, useMemo} from 'react';
import PropTypes from 'prop-types';
import SearchBar from '@ui/DataBar/SearchBar';
import useSearch from '@hooks/useSearch';
import AdvancedView from './AdvancedView';
import BasicView from './BasicView';
import FormatSelectorModal from './FormatSelectorModal';
import FormatSettingsModal from './FormatSettingsModal';
import {Settings, Plus, CheckSquare} from 'lucide-react';
import Tooltip from '@ui/Tooltip';

const FormatSettings = ({formats, onScoreChange, appType = 'both', activeApp, onAppChange}) => {
    // Initialize state from localStorage, falling back to true if no value is stored
    const [isAdvancedView, setIsAdvancedView] = useState(() => {
        const stored = localStorage.getItem('formatSettingsView');
        return stored === null ? true : JSON.parse(stored);
    });

    // Initialize selectiveMode from localStorage (global setting)
    const [showSelectiveMode, setShowSelectiveMode] = useState(() => {
        const stored = localStorage.getItem('formatSettingsSelectiveMode');
        return stored === null ? false : JSON.parse(stored);
    });
    
    const [availableFormats, setAvailableFormats] = useState([]);
    const [selectedFormatIds, setSelectedFormatIds] = useState(() => {
        try {
            const stored = localStorage.getItem(`selectedFormatIds_${appType}`);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });
    
    // Format selector modal state
    const [isSelectorModalOpen, setIsSelectorModalOpen] = useState(false);
    
    // Settings modal state
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    
    // Calculate which formats to display
    const displayFormats = useMemo(() => {
        if (showSelectiveMode) {
            // In selective mode:
            // 1. Display all formats with non-zero scores
            // 2. Also display formats with zero scores that are explicitly selected
            const nonZeroFormats = formats.filter(f => f.score !== 0);
            const selectedZeroFormats = formats.filter(f => 
                f.score === 0 && selectedFormatIds.includes(f.id)
            );
            
            return [...nonZeroFormats, ...selectedZeroFormats];
        } else {
            // In regular mode, display all formats as usual
            return formats;
        }
    }, [formats, showSelectiveMode, selectedFormatIds]);

    // Save to localStorage whenever view preferences change
    useEffect(() => {
        localStorage.setItem('formatSettingsView', JSON.stringify(isAdvancedView));
    }, [isAdvancedView]);

    useEffect(() => {
        localStorage.setItem('formatSettingsSelectiveMode', JSON.stringify(showSelectiveMode));
    }, [showSelectiveMode]);
    
    // Save selected format IDs to localStorage
    useEffect(() => {
        localStorage.setItem(`selectedFormatIds_${appType}`, JSON.stringify(selectedFormatIds));
    }, [selectedFormatIds, appType]);

    // Calculate available formats for selection (not already in use)
    useEffect(() => {
        // To be "available", a format must have zero score and not be in selectedFormatIds
        const usedFormatIds = formats.filter(f => f.score !== 0).map(f => f.id);
        const allUnavailableIds = [...usedFormatIds, ...selectedFormatIds];
        
        // Available formats are those not already used or selected
        const available = formats.filter(format => 
            !allUnavailableIds.includes(format.id)
        );
        
        setAvailableFormats(available);
    }, [formats, selectedFormatIds]);

    // Search hook for filtering formats
    const {
        searchTerms,
        currentInput,
        setCurrentInput,
        addSearchTerm,
        removeSearchTerm,
        clearSearchTerms,
        items: filteredFormats
    } = useSearch(displayFormats, {
        searchableFields: ['name']
    });

    // Handle format toggle (add/remove)
    const handleFormatToggle = (formatId) => {
        const format = formats.find(f => f.id === formatId);
        
        if (!format) return;
        
        // Check if this format is already selected (either has a non-zero score or is in selectedFormatIds)
        const isSelected = format.score !== 0 || selectedFormatIds.includes(formatId);
        
        if (isSelected) {
            // Remove format
            if (format.score !== 0) {
                // If format has a non-zero score, set it to 0 (don't remove it completely)
                onScoreChange(formatId, 0);
            }
            // If format was explicitly selected, remove from the selection list
            setSelectedFormatIds(prev => prev.filter(id => id !== formatId));
        } else {
            // Add format
            // Set the format score to 0 initially, just to mark it as "selected"
            onScoreChange(formatId, 0);
            
            // Add to our list of explicitly selected format IDs
            setSelectedFormatIds(prev => [...prev, formatId]);
        }
    };

    // When a format score changes, we need to update our tracking
    const handleScoreChange = (formatId, score) => {
        // Pass the score change to parent
        onScoreChange(formatId, score);
        
        const format = formats.find(f => f.id === formatId);
        if (!format) return;
        
        if (score !== 0) {
            // If the score is changing from 0 to non-zero, we no longer need to track it
            // as an explicitly selected format (it's tracked by virtue of its non-zero score)
            if (format.score === 0 && selectedFormatIds.includes(formatId)) {
                // Format was previously explicitly selected with zero score, but now has a non-zero score
                // We can remove it from our explicit selection tracking
                setSelectedFormatIds(prev => prev.filter(id => id !== formatId));
            }
        } else {
            // If the score is changing to 0, we need to track it as explicitly selected
            // so it remains visible in selective mode
            if (format.score !== 0 && !selectedFormatIds.includes(formatId)) {
                // Format was previously non-zero, but now is 0
                // Add it to our explicit selection tracking
                setSelectedFormatIds(prev => [...prev, formatId]);
            }
        }
    };

    
    // Open the format selector modal
    const openFormatSelector = () => {
        setIsSelectorModalOpen(true);
    };

    return (
        <div className='space-y-4'>
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

                <div className='flex gap-2'>
                    {/* Settings Button */}
                    <Tooltip content="Format settings" position="bottom">
                        <button
                            onClick={() => setIsSettingsModalOpen(true)}
                            className='px-3 py-2 rounded-md border border-gray-300 bg-white hover:border-gray-400 transition-colors dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600 flex items-center gap-2'
                        >
                            <Settings size={16} className='text-gray-500 dark:text-gray-400' />
                            <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>Settings</span>
                        </button>
                    </Tooltip>
                    
                    {/* Selective Mode Toggle */}
                    <button
                        onClick={() => setShowSelectiveMode(prev => !prev)}
                        className={`px-3 py-2 rounded-md border transition-colors flex items-center gap-2 ${
                            showSelectiveMode
                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                                : 'border-gray-300 bg-white hover:border-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600'
                        }`}
                        title={showSelectiveMode ? 'Hide unused formats' : 'Show all formats'}
                    >
                        <CheckSquare size={16} />
                        <span className='text-sm font-medium'>Selective</span>
                    </button>
                    
                    {/* Add Format Button (only show in selective mode) */}
                    {showSelectiveMode && (
                        <Tooltip content="Add formats to profile" position="bottom">
                            <button
                                onClick={openFormatSelector}
                                className="px-3 py-2 border rounded-md border-gray-300 bg-white hover:border-gray-400 transition-colors dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600 flex items-center gap-2"
                            >
                                <Plus size={16} className='text-gray-500 dark:text-gray-400' />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add</span>
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* Format Selector Modal */}
            <FormatSelectorModal
                isOpen={isSelectorModalOpen}
                onClose={() => setIsSelectorModalOpen(false)}
                availableFormats={availableFormats}
                selectedFormatIds={selectedFormatIds}
                allFormats={formats}
                onFormatToggle={handleFormatToggle}
            />

            {/* Settings Modal */}
            <FormatSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                activeApp={activeApp}
                onAppChange={onAppChange}
                isAdvancedView={isAdvancedView}
                onViewChange={setIsAdvancedView}
            />

            {/* Format Display */}
            {isAdvancedView ? (
                <AdvancedView
                    formats={filteredFormats}
                    onScoreChange={handleScoreChange}
                    onFormatRemove={formatId => handleFormatToggle(formatId)}
                    showRemoveButton={showSelectiveMode}
                />
            ) : (
                <BasicView
                    formats={filteredFormats}
                    onScoreChange={handleScoreChange}
                    onFormatRemove={formatId => handleFormatToggle(formatId)}
                    showRemoveButton={showSelectiveMode}
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
    onScoreChange: PropTypes.func.isRequired,
    appType: PropTypes.oneOf(['both', 'radarr', 'sonarr']),
    activeApp: PropTypes.oneOf(['both', 'radarr', 'sonarr']).isRequired,
    onAppChange: PropTypes.func.isRequired
};

export default FormatSettings;