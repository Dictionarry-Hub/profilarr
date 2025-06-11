import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CategoryContainer from './CategoryContainer';
import QualityGroup from './QualityGroup';
import QualityItem from './QualityItem';

const QualityDefinitions = ({ data, arrType, onSave, onSync, isSaving }) => {
    const [expandedGroups, setExpandedGroups] = useState({});
    const [localData, setLocalData] = useState({});

    useEffect(() => {
        if (data) {
            setLocalData(data);
        }
    }, [data]);

    const handleQualityChange = (qualityName, newSettings) => {
        setLocalData(prev => ({
            ...prev,
            [qualityName]: newSettings
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
            'Prereleases': ['WORKPRINT', 'CAM', 'TELESYNC', 'TELECINE', 'DVDSCR'],
            'SD': ['DVD', 'DVD-R', 'WEBDL-480p', 'WEBRip-480p', 'Bluray-480p', 'Bluray-576p', 'SDTV'],
            'HD-720p': ['HDTV-720p', 'WEBDL-720p', 'WEBRip-720p', 'Bluray-720p'],
            'HD-1080p': ['HDTV-1080p', 'WEBDL-1080p', 'WEBRip-1080p', 'Bluray-1080p', 'Remux-1080p', 'Bluray-1080p Remux'],
            'UHD-2160p': ['HDTV-2160p', 'WEBDL-2160p', 'WEBRip-2160p', 'Bluray-2160p', 'Remux-2160p', 'Bluray-2160p Remux'],
            'Other': ['BR-DISK', 'Raw-HD', 'Unknown', 'REGIONAL']
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
                    <QualityGroup
                        key={groupName}
                        title={groupName}
                        isExpanded={expandedGroups[groupName]}
                        onToggle={() => toggleGroup(groupName)}
                    >
                        {Object.entries(qualities).map(([qualityName, settings]) => (
                            <QualityItem
                                key={qualityName}
                                name={qualityName}
                                settings={settings}
                                onChange={(newSettings) => handleQualityChange(qualityName, newSettings)}
                            />
                        ))}
                    </QualityGroup>
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