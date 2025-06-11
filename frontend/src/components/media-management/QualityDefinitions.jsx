import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import CategoryContainer from './CategoryContainer';

const QualityDefinitions = ({ data, arrType, onSave, onSync, isSaving }) => {
    const [expandedGroups, setExpandedGroups] = useState({});
    const [localData, setLocalData] = useState({});
    
    useEffect(() => {
        if (data) {
            setLocalData(data);
        }
    }, [data]);

    const handleQualityChange = (qualityName, field, value) => {
        setLocalData(prev => ({
            ...prev,
            [qualityName]: {
                ...prev[qualityName],
                [field]: parseInt(value) || 0
            }
        }));
    };

    const handleSave = () => {
        onSave && onSave(localData);
    };

    const handleSync = () => {
        onSync && onSync();
    };

    const toggleGroup = (group) => {
        setExpandedGroups(prev => ({
            ...prev,
            [group]: !prev[group]
        }));
    };

    // Group qualities by resolution
    const groupQualities = (qualities) => {
        const groups = {
            'Low Quality': ['Unknown', 'WORKPRINT', 'CAM', 'TELESYNC', 'TELECINE', 'REGIONAL', 'DVDSCR', 'SDTV'],
            'SD': ['DVD', 'DVD-R', 'WEBDL-480p', 'WEBRip-480p', 'Bluray-480p', 'Bluray-576p'],
            'HD-720p': ['HDTV-720p', 'WEBDL-720p', 'WEBRip-720p', 'Bluray-720p'],
            'HD-1080p': ['HDTV-1080p', 'WEBDL-1080p', 'WEBRip-1080p', 'Bluray-1080p', 'Remux-1080p', 'Bluray-1080p Remux'],
            'UHD-2160p': ['HDTV-2160p', 'WEBDL-2160p', 'WEBRip-2160p', 'Bluray-2160p', 'Remux-2160p', 'Bluray-2160p Remux'],
            'Other': ['BR-DISK', 'Raw-HD']
        };

        const grouped = {};
        Object.entries(groups).forEach(([groupName, qualityNames]) => {
            const groupQualities = {};
            qualityNames.forEach(name => {
                if (qualities && qualities[name]) {
                    groupQualities[name] = qualities[name];
                }
            });
            if (Object.keys(groupQualities).length > 0) {
                grouped[groupName] = groupQualities;
            }
        });
        
        return grouped;
    };

    const qualityGroups = groupQualities(localData);

    return (
        <CategoryContainer
            title="Quality Definitions"
            onSync={handleSync}
            onSave={handleSave}
            isSaving={isSaving}
        >
            <div className="space-y-4">
                {Object.entries(qualityGroups).map(([groupName, qualities]) => (
                    <div key={groupName} className="border border-gray-700 dark:border-gray-700 rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleGroup(groupName)}
                            className="w-full px-4 py-3 bg-gray-750 dark:bg-gray-750 hover:bg-gray-700 dark:hover:bg-gray-700 flex items-center justify-between transition-colors"
                        >
                            <span className="text-sm font-medium text-gray-100 dark:text-gray-100">
                                {groupName}
                            </span>
                            {expandedGroups[groupName] ? 
                                <ChevronDown size={16} className="text-gray-400" /> : 
                                <ChevronRight size={16} className="text-gray-400" />
                            }
                        </button>
                        
                        {expandedGroups[groupName] && (
                            <div className="p-4 space-y-3">
                                {Object.entries(qualities).map(([qualityName, settings]) => (
                                    <div key={qualityName} className="grid grid-cols-4 gap-4 items-center">
                                        <div className="text-sm text-gray-300 dark:text-gray-300">
                                            {qualityName}
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 dark:text-gray-400 mb-1">
                                                Min (MB)
                                            </label>
                                            <input
                                                type="number"
                                                value={settings.min || 0}
                                                onChange={(e) => handleQualityChange(qualityName, 'min', e.target.value)}
                                                className="w-full px-2 py-1 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded text-gray-100 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 dark:text-gray-400 mb-1">
                                                Preferred (MB)
                                            </label>
                                            <input
                                                type="number"
                                                value={settings.preferred || 0}
                                                onChange={(e) => handleQualityChange(qualityName, 'preferred', e.target.value)}
                                                className="w-full px-2 py-1 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded text-gray-100 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 dark:text-gray-400 mb-1">
                                                Max (MB)
                                            </label>
                                            <input
                                                type="number"
                                                value={settings.max || 0}
                                                onChange={(e) => handleQualityChange(qualityName, 'max', e.target.value)}
                                                className="w-full px-2 py-1 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded text-gray-100 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-4 text-xs text-gray-400 dark:text-gray-400">
                <p>Quality size limits help manage storage space and bandwidth usage.</p>
                <p className="mt-1">Files outside these limits may be rejected or upgraded based on your settings.</p>
            </div>
        </CategoryContainer>
    );
};

QualityDefinitions.propTypes = {
    data: PropTypes.object,
    arrType: PropTypes.oneOf(['radarr', 'sonarr']).isRequired,
    onSave: PropTypes.func,
    onSync: PropTypes.func,
    isSaving: PropTypes.bool
};

export default QualityDefinitions;