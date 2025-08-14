import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { Check, Plus, X, Volume2, Monitor, Users, Tv, Code, HardDrive, Tag, Square, Layers, Database } from 'lucide-react';

const GroupFilter = memo(({ onGroupChange }) => {
    const [newTagInput, setNewTagInput] = useState('');
    const dropdownRef = useRef(null);
    
    // Initialize from localStorage immediately
    const [selectedGroups, setSelectedGroups] = useState(() => {
        const saved = localStorage.getItem('scoringGroupFilters');
        return saved ? JSON.parse(saved) : ['All Groups'];
    });
    
    const [customTags, setCustomTags] = useState(() => {
        const saved = localStorage.getItem('scoringCustomTags');
        return saved ? JSON.parse(saved) : [];
    });

    const allGroupsOption = { name: 'All Groups', icon: Layers };
    
    const predefinedGroups = [
        { name: 'Audio', icon: Volume2 },
        { name: 'HDR', icon: Monitor },
        { name: 'Release Groups', icon: Users },
        { name: 'Streaming Services', icon: Tv },
        { name: 'Codecs', icon: Code },
        { name: 'Storage', icon: HardDrive },
        { name: 'Release Group Tiers', icon: Tag },
        { name: 'Resolution', icon: Square },
        { name: 'Source', icon: Database },
        { name: 'Indexer Flags', icon: Tag }
    ];



    // Dispatch changes
    useEffect(() => {
        onGroupChange({ selectedGroups, customTags });
    }, [selectedGroups, customTags, onGroupChange]);

    const toggleGroup = useCallback((groupName) => {
        let newGroups;
        
        if (groupName === 'All Groups') {
            newGroups = ['All Groups'];
        } else {
            // Remove "All Groups" if adding specific group
            let filtered = selectedGroups.filter(g => g !== 'All Groups');
            
            if (filtered.includes(groupName)) {
                filtered = filtered.filter(g => g !== groupName);
                // If no groups left, default to "All Groups"
                if (filtered.length === 0) {
                    filtered = ['All Groups'];
                }
            } else {
                filtered = [...filtered, groupName];
            }
            newGroups = filtered;
        }
        
        setSelectedGroups(newGroups);
        localStorage.setItem('scoringGroupFilters', JSON.stringify(newGroups));
    }, [selectedGroups]);

    const addCustomTag = useCallback(() => {
        const trimmedTag = newTagInput.trim();
        if (trimmedTag && !customTags.includes(trimmedTag)) {
            const newCustomTags = [...customTags, trimmedTag];
            setCustomTags(newCustomTags);
            
            // Also select the new custom tag
            const newSelectedGroups = selectedGroups.filter(g => g !== 'All Groups');
            newSelectedGroups.push(trimmedTag);
            setSelectedGroups(newSelectedGroups);
            
            setNewTagInput('');
            
            localStorage.setItem('scoringCustomTags', JSON.stringify(newCustomTags));
            localStorage.setItem('scoringGroupFilters', JSON.stringify(newSelectedGroups));
        }
    }, [newTagInput, customTags, selectedGroups]);

    const removeCustomTag = useCallback((tag) => {
        const newCustomTags = customTags.filter(t => t !== tag);
        const newSelectedGroups = selectedGroups.filter(g => g !== tag);
        
        setCustomTags(newCustomTags);
        setSelectedGroups(newSelectedGroups.length === 0 ? ['All Groups'] : newSelectedGroups);
        
        localStorage.setItem('scoringCustomTags', JSON.stringify(newCustomTags));
        localStorage.setItem('scoringGroupFilters', JSON.stringify(newSelectedGroups));
    }, [customTags, selectedGroups]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCustomTag();
        }
    }, [addCustomTag]);

    const activeGroupCount = selectedGroups.filter(g => g !== 'All Groups').length;
    const groupOptions = [allGroupsOption, ...predefinedGroups, ...customTags.map(tag => ({ name: tag, icon: Tag, isCustom: true }))];

    return (
        <div className="relative group/dropdown">
            <button
                className="flex items-center justify-center px-3 py-2 h-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative"
            >
                <Layers className="w-4 h-4" />
                
                {/* Active indicator */}
                {activeGroupCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-medium text-white leading-none">{activeGroupCount}</span>
                    </div>
                )}
            </button>

            {/* Invisible bridge to maintain hover connection */}
            <div className="absolute top-full left-0 right-0 h-2 hidden group-hover/dropdown:block" />
            
            {/* Dropdown - Pure CSS hover */}
            <div 
                ref={dropdownRef}
                className="absolute z-20 top-full mt-2 right-0 w-64 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden transition-all duration-200 opacity-0 invisible translate-y-[-10px] pointer-events-none group-hover/dropdown:opacity-100 group-hover/dropdown:visible group-hover/dropdown:translate-y-0 group-hover/dropdown:pointer-events-auto">
                {/* Extended invisible bridge inside dropdown */}
                <div className="absolute -top-2 -left-4 -right-4 h-3" />
                <div className="overflow-y-auto">
                    {groupOptions.map((group) => (
                        <div
                            key={group.name}
                            onClick={() => !group.isCustom && toggleGroup(group.name)}
                            className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                                group.isCustom ? 'group' : ''
                            }`}
                        >
                            <div className="flex items-center gap-2 flex-1">
                                <group.icon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{group.name}</span>
                                {group.isCustom && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeCustomTag(group.name);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 text-gray-400 hover:text-white hover:bg-red-500 dark:hover:bg-red-600 rounded transition-all"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            {selectedGroups.includes(group.name) && (
                                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                
                {/* Custom tag input */}
                <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Add custom tag..."
                        className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
                    />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            addCustomTag();
                        }}
                        className="w-5 h-5 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 rounded-full flex items-center justify-center transition-colors group"
                    >
                        <Plus className="w-3 h-3 text-gray-600 dark:text-gray-400 group-hover:text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
});

GroupFilter.propTypes = {
    onGroupChange: PropTypes.func.isRequired
};

export default GroupFilter;