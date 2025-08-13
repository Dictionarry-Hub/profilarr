import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import SearchBar from '@ui/DataBar/SearchBar';
import useSearch from '@hooks/useSearch';
import GroupFilter from './GroupFilter';
import FormatGroup from './FormatGroup';
import { Layers } from 'lucide-react';

const FormatSettings = ({ formats, onScoreChange, onFormatToggle, activeApp }) => {
    // Track the initial formats to detect profile changes
    const initialFormatsRef = useRef(null);
    const sortOrderRef = useRef([]);
    const [groupFilter, setGroupFilter] = useState({ selectedGroups: ['All Groups'], customTags: [] });
    const [isProcessing, setIsProcessing] = useState(true);
    const [sortedFormats, setSortedFormats] = useState([]);
    
    const handleGroupChange = useCallback((filter) => {
        setGroupFilter(filter);
    }, []);
    
    const processSortedFormats = useCallback(() => {
        // Create a unique key for the current format set
        const currentFormatKey = formats.map(f => f.id).sort().join(',');
        const previousFormatKey = initialFormatsRef.current?.key;
        
        // Check if this is a new profile (different format set)
        const isNewProfile = !previousFormatKey || currentFormatKey !== previousFormatKey;
        
        let sorted = formats;
        
        if (isNewProfile && formats.length > 0) {
            // New profile - create fresh sort and clear old sort order
            sortOrderRef.current = [];
            initialFormatsRef.current = { 
                key: currentFormatKey,
                ids: formats.map(f => f.id)
            };
            
            // Pre-calculate scores and active status for efficiency
            const formatsWithMeta = formats.map(format => {
                const isActive = Boolean(format.radarr) || Boolean(format.sonarr);
                let maxScore = 0;
                
                if (isActive) {
                    const scores = [];
                    if (format.radarr) scores.push(format.radarrScore ?? format.score ?? 0);
                    if (format.sonarr) scores.push(format.sonarrScore ?? format.score ?? 0);
                    maxScore = scores.length > 0 ? Math.max(...scores) : 0;
                }
                
                return {
                    format,
                    isActive,
                    maxScore,
                    nameLower: format.name.toLowerCase()
                };
            });
            
            // Sort using pre-calculated values
            formatsWithMeta.sort((a, b) => {
                // Active formats first
                if (a.isActive !== b.isActive) {
                    return a.isActive ? -1 : 1;
                }
                
                // If both active, sort by score
                if (a.isActive && a.maxScore !== b.maxScore) {
                    return b.maxScore - a.maxScore;
                }
                
                // Same score or both inactive - sort alphabetically
                return a.nameLower.localeCompare(b.nameLower);
            });
            
            sorted = formatsWithMeta.map(item => item.format);
            
            // Store the sort order
            sortOrderRef.current = sorted.map(f => f.id);
        } else if (sortOrderRef.current.length > 0) {
            // Same profile - maintain existing order
            const idToFormat = new Map(formats.map(f => [f.id, f]));
            sorted = sortOrderRef.current
                .map(id => idToFormat.get(id))
                .filter(Boolean);
        }
        
        setSortedFormats(sorted);
        setIsProcessing(false);
    }, [formats]);
    
    // Process formats asynchronously to avoid blocking the UI
    useEffect(() => {
        setIsProcessing(true);
        setSortedFormats([]); // Clear previous sorted formats immediately
        
        // Use requestIdleCallback for better performance, fallback to setTimeout
        if ('requestIdleCallback' in window) {
            const id = requestIdleCallback(() => {
                processSortedFormats();
            }, { timeout: 100 });
            
            return () => cancelIdleCallback(id);
        } else {
            const timeoutId = setTimeout(() => {
                processSortedFormats();
            }, 10);
            
            return () => clearTimeout(timeoutId);
        }
    }, [formats, processSortedFormats]);
    
    // Group formats based on selected groups
    const groupedFormats = useMemo(() => {
        if (groupFilter.selectedGroups.includes('All Groups')) {
            // When "All Groups" is selected, show all formats in a single group
            return { 'Custom Formats': sortedFormats };
        }
        
        const groups = {};
        const selectedGroupsSet = new Set(groupFilter.selectedGroups);
        
        // Pre-compile matching patterns for better performance
        const matchers = {
            'Audio': (tag) => /audio|atmos|dts|truehd|flac|aac/i.test(tag),
            'HDR': (tag) => /hdr|dv|dolby|vision/i.test(tag),
            'Release Groups': (tag) => /group/i.test(tag) && !/tier/i.test(tag),
            'Streaming Services': (tag) => /streaming|web|netflix|amazon/i.test(tag),
            'Codecs': (tag) => /codec|x264|x265|h264|h265|av1/i.test(tag),
            'Resolution': (tag) => /resolution|1080|2160|720|4k/i.test(tag),
            'Source': (tag) => /source|bluray|remux|web/i.test(tag),
            'Storage': (tag) => /storage|size/i.test(tag),
            'Release Group Tiers': (tag) => /tier/i.test(tag),
            'Indexer Flags': (tag) => /indexer|flag/i.test(tag)
        };
        
        // Group formats by matching tags
        for (const format of sortedFormats) {
            if (!format.tags || format.tags.length === 0) continue;
            
            // Check each selected group
            for (const groupName of selectedGroupsSet) {
                const matcher = matchers[groupName];
                const hasMatchingTag = matcher 
                    ? format.tags.some(tag => matcher(tag))
                    : format.tags.some(tag => {
                        const tagLower = tag.toLowerCase();
                        const groupLower = groupName.toLowerCase();
                        return tagLower.includes(groupLower) || groupLower.includes(tagLower);
                    });
                
                if (hasMatchingTag) {
                    if (!groups[groupName]) {
                        groups[groupName] = [];
                    }
                    groups[groupName].push(format);
                }
            }
        }
        
        return groups;
    }, [sortedFormats, groupFilter.selectedGroups]);
    
    // Flatten grouped formats for search
    const allGroupedFormats = useMemo(() => {
        return Object.values(groupedFormats).flat();
    }, [groupedFormats]);
    
    const {
        searchTerms,
        currentInput,
        setCurrentInput,
        addSearchTerm,
        removeSearchTerm,
        clearSearchTerms,
        items: searchFilteredFormats
    } = useSearch(allGroupedFormats, {
        searchableFields: ['name'],
        initialSortBy: 'custom',
        sortOptions: {
            custom: (a, b) => {
                // Maintain our custom sort order (already sorted in sortedFormats)
                // Just return 0 to keep the existing order
                return 0;
            }
        }
    });
    
    // Filter grouped formats based on search
    const filteredGroupedFormats = useMemo(() => {
        if (searchTerms.length === 0 && !currentInput) {
            return groupedFormats;
        }
        
        const filteredGroups = {};
        const searchIds = new Set(searchFilteredFormats.map(f => f.id));
        
        Object.entries(groupedFormats).forEach(([groupName, formats]) => {
            const filteredFormats = formats.filter(f => searchIds.has(f.id));
            if (filteredFormats.length > 0) {
                filteredGroups[groupName] = filteredFormats;
            }
        });
        
        return filteredGroups;
    }, [groupedFormats, searchFilteredFormats, searchTerms, currentInput]);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <SearchBar
                    className="flex-1"
                    placeholder="Search formats..."
                    searchTerms={searchTerms}
                    currentInput={currentInput}
                    onInputChange={setCurrentInput}
                    onAddTerm={addSearchTerm}
                    onRemoveTerm={removeSearchTerm}
                    onClearTerms={clearSearchTerms}
                />
                <GroupFilter onGroupChange={handleGroupChange} />
            </div>

            <div className="mt-4">
                {isProcessing ? (
                    <div className="space-y-4">
                        {/* Loading skeleton */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                            <div className="animate-pulse">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    </div>
                                    <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : Object.keys(filteredGroupedFormats).length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">No formats match your current filters</p>
                    </div>
                ) : (
                    Object.entries(filteredGroupedFormats).map(([groupName, groupFormats]) => (
                        <FormatGroup
                            key={groupName}
                            groupName={groupName}
                            formats={groupFormats}
                            onScoreChange={onScoreChange}
                            onFormatToggle={onFormatToggle}
                            icon={groupName === 'Custom Formats' ? Layers : null}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

FormatSettings.propTypes = {
    formats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            score: PropTypes.number,
            radarrScore: PropTypes.number,
            sonarrScore: PropTypes.number,
            radarr: PropTypes.bool,
            sonarr: PropTypes.bool,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    onScoreChange: PropTypes.func.isRequired,
    onFormatToggle: PropTypes.func.isRequired,
    activeApp: PropTypes.oneOf(['both', 'radarr', 'sonarr'])
};

export default FormatSettings;