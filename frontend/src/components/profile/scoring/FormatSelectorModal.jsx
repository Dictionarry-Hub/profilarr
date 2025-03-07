import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import Modal from '@ui/Modal';
import SearchBar from '@ui/DataBar/SearchBar';
import useSearch from '@hooks/useSearch';
import { Plus, Check, Settings, Grid3X3 } from 'lucide-react';
import { groupFormatsByTags, getGroupIcon, FORMAT_GROUP_NAMES } from '@constants/formatGroups';

const FormatSelectorModal = ({ 
    isOpen, 
    onClose, 
    availableFormats,
    selectedFormatIds,
    allFormats,
    onFormatToggle
}) => {
    // State to track view mode (basic/advanced)
    const [viewMode, setViewMode] = useState(() => {
        const stored = localStorage.getItem('formatSelectorViewMode');
        return stored === null ? 'basic' : JSON.parse(stored);
    });

    // Save view mode preference
    const toggleViewMode = () => {
        const newMode = viewMode === 'basic' ? 'advanced' : 'basic';
        setViewMode(newMode);
        localStorage.setItem('formatSelectorViewMode', JSON.stringify(newMode));
    };

    // Group formats for advanced view
    const groupedFormats = useMemo(() => {
        return groupFormatsByTags(allFormats);
    }, [allFormats]);

    // Search functionality
    const {
        searchTerms,
        currentInput,
        setCurrentInput,
        addSearchTerm,
        removeSearchTerm,
        clearSearchTerms,
        items: filteredFormats
    } = useSearch(allFormats, {
        searchableFields: ['name', 'tags']
    });

    // Handle format selection/deselection
    const handleFormatClick = (formatId) => {
        onFormatToggle(formatId);
    };

    // Handle format card rendering for basic view
    const renderFormatCard = (format) => {
        const isSelected = selectedFormatIds.includes(format.id) || format.score !== 0;
        
        return (
            <div 
                key={format.id}
                className={`p-2 rounded border transition-colors mb-1.5 cursor-pointer
                    ${isSelected 
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/30 dark:border-green-700' 
                        : 'border-gray-300 bg-white hover:border-blue-400 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-blue-600'
                    }`}
                onClick={() => handleFormatClick(format.id)}
            >
                <div className="flex justify-between items-center">
                    <div className="flex-1 truncate mr-2">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{format.name}</h3>
                        {format.tags && format.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                                {format.tags.slice(0, 2).map(tag => (
                                    <span key={tag} className="px-1.5 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                        {tag}
                                    </span>
                                ))}
                                {format.tags.length > 2 && (
                                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                        +{format.tags.length - 2}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    {isSelected ? (
                        <Check className="text-green-500 dark:text-green-400 flex-shrink-0" size={16} />
                    ) : (
                        <Plus className="text-gray-400 dark:text-gray-500 flex-shrink-0" size={16} />
                    )}
                </div>
            </div>
        );
    };

    // Render advanced (grouped) view
    const renderAdvancedView = () => {
        return (
            <div className="space-y-4">
                {Object.entries(groupedFormats)
                    .filter(([_, formats]) => formats.length > 0) // Only render non-empty groups
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([groupName, formats]) => {
                        // Filter formats to match search
                        const filteredGroupFormats = formats.filter(format => 
                            filteredFormats.some(f => f.id === format.id)
                        );

                        // Skip empty groups after filtering
                        if (filteredGroupFormats.length === 0) {
                            return null;
                        }
                        
                        return (
                            <div key={groupName} className="mb-4">
                                <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center mb-2">
                                    {getGroupIcon(groupName)}
                                    <span className="ml-1">{groupName}</span>
                                    <span className="ml-1 text-gray-500 dark:text-gray-400">({filteredGroupFormats.length})</span>
                                </h3>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0">
                                    {filteredGroupFormats.map(renderFormatCard)}
                                </div>
                            </div>
                        );
                    })
                }

                {filteredFormats.length === 0 && (
                    <div className="py-8 text-center text-gray-500 dark:text-gray-400 italic">
                        No formats found matching your search
                    </div>
                )}
            </div>
        );
    };

    // Render basic view (simple grid)
    const renderBasicView = () => {
        return (
            <>
                {filteredFormats.length > 0 ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0">
                        {filteredFormats.map(renderFormatCard)}
                    </div>
                ) : (
                    <div className="py-8 text-center text-gray-500 dark:text-gray-400 italic">
                        No formats found matching your search
                    </div>
                )}
            </>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Select Formats"
            width="2xl"
            height="4xl"
        >
            <div className="h-full flex flex-col">
                <div className="mb-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Select formats to include in your profile. Click a format to toggle its selection.
                    </div>
                    
                    <div className="flex items-center gap-3">
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
                        
                        <button
                            onClick={toggleViewMode}
                            className="flex items-center gap-1 px-3 py-2 rounded-md border border-gray-300 bg-white hover:border-gray-400 transition-colors dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600"
                            title={viewMode === 'basic' ? 'Switch to Advanced View' : 'Switch to Basic View'}
                        >
                            {viewMode === 'basic' ? (
                                <>
                                    <Settings size={16} className="text-gray-500 dark:text-gray-400" />
                                    <span className="text-sm font-medium">Advanced</span>
                                </>
                            ) : (
                                <>
                                    <Grid3X3 size={16} className="text-gray-500 dark:text-gray-400" />
                                    <span className="text-sm font-medium">Basic</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
                
                <div className="format-count text-xs mb-2">
                    <span className="text-green-600 dark:text-green-400 font-medium">{selectedFormatIds.length + allFormats.filter(f => f.score !== 0).length}</span> of {allFormats.length} formats selected
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1">
                    {viewMode === 'basic' ? renderBasicView() : renderAdvancedView()}
                </div>
            </div>
        </Modal>
    );
};

FormatSelectorModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    availableFormats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            score: PropTypes.number,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ),
    selectedFormatIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    allFormats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            score: PropTypes.number,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    onFormatToggle: PropTypes.func.isRequired
};

export default FormatSelectorModal;