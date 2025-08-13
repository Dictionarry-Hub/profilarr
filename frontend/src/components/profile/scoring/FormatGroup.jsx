import React, { useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, Volume2, Monitor, Users, Tv, Code, HardDrive, Tag, Square, Layers, Database, Folder } from 'lucide-react';
import NumberInput from '@ui/NumberInput';
import Tooltip from '@ui/Tooltip';
import { Copy } from 'lucide-react';

const FormatGroup = memo(({ groupName, formats, onScoreChange, onFormatToggle, icon }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    
    // Map group names to icons
    const groupIcons = {
        'Audio': Volume2,
        'HDR': Monitor,
        'Release Groups': Users,
        'Streaming Services': Tv,
        'Codecs': Code,
        'Storage': HardDrive,
        'Release Group Tiers': Tag,
        'Resolution': Square,
        'Source': Database,
        'Indexer Flags': Tag,
        'Custom Formats': Layers,
        'Uncategorized': Folder
    };
    
    // Use provided icon or look up based on group name
    const GroupIcon = icon || groupIcons[groupName] || Tag;
    
    const handleAppToggle = useCallback((formatId, app) => {
        const format = formats.find(f => f.id === formatId);
        onFormatToggle(formatId, app, !format[app]);
    }, [formats, onFormatToggle]);

    const handleScoreChange = useCallback((formatId, app, score) => {
        onScoreChange(formatId, app, score);
    }, [onScoreChange]);

    const handleCopyScore = useCallback((formatId, fromApp, toApp) => {
        const format = formats.find(f => f.id === formatId);
        if (format) {
            const scoreKey = `${fromApp}Score`;
            const score = format[scoreKey] || format.score || 0;
            onScoreChange(formatId, toApp, score);
        }
    }, [formats, onScoreChange]);
    
    return (
        <div className="mb-6">
            {/* Group Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <GroupIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{groupName}</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">({formats.length})</span>
                </div>
                
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    aria-label={`${isExpanded ? 'Hide' : 'Show'} ${groupName} formats`}
                >
                    <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                </button>
            </div>
            
            {/* Formats Table */}
            {isExpanded && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/2">
                                    Format
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Radarr
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Sonarr
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {formats.map((format) => {
                                const isActive = Boolean(format.radarr) || Boolean(format.sonarr);
                                const radarrScore = format.radarrScore ?? format.score ?? 0;
                                const sonarrScore = format.sonarrScore ?? format.score ?? 0;
                                
                                return (
                                    <tr
                                        key={format.id}
                                        className={`transition-all ${
                                            !isActive ? 'opacity-40 bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'
                                        }`}
                                    >
                                        <td className="px-4 py-3">
                                            <div
                                                className={`font-medium text-sm ${
                                                    isActive
                                                        ? 'text-gray-900 dark:text-gray-100'
                                                        : 'text-gray-500 dark:text-gray-400'
                                                }`}
                                            >
                                                {format.name}
                                            </div>
                                            {format.tags && format.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {format.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="px-1.5 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 text-xs rounded"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleAppToggle(format.id, 'radarr')}
                                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                                        format.radarr 
                                                            ? 'bg-yellow-500 border-yellow-500' 
                                                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-yellow-400'
                                                    }`}
                                                >
                                                    {format.radarr && (
                                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <NumberInput
                                                    value={radarrScore}
                                                    onChange={(score) => handleScoreChange(format.id, 'radarr', score)}
                                                    className="w-24"
                                                    step={1000}
                                                    disabled={!format.radarr}
                                                />
                                                {format.radarr && format.sonarr && (
                                                    <Tooltip content="Copy to Sonarr" position="top">
                                                        <button
                                                            onClick={() => handleCopyScore(format.id, 'radarr', 'sonarr')}
                                                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleAppToggle(format.id, 'sonarr')}
                                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                                        format.sonarr 
                                                            ? 'bg-blue-500 border-blue-500' 
                                                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                                                    }`}
                                                >
                                                    {format.sonarr && (
                                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <NumberInput
                                                    value={sonarrScore}
                                                    onChange={(score) => handleScoreChange(format.id, 'sonarr', score)}
                                                    className="w-24"
                                                    step={1000}
                                                    disabled={!format.sonarr}
                                                />
                                                {format.radarr && format.sonarr && (
                                                    <Tooltip content="Copy to Radarr" position="top">
                                                        <button
                                                            onClick={() => handleCopyScore(format.id, 'sonarr', 'radarr')}
                                                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
});

FormatGroup.propTypes = {
    groupName: PropTypes.string.isRequired,
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
    icon: PropTypes.elementType
};

export default FormatGroup;