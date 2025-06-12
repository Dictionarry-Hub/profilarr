import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CategoryContainer from './CategoryContainer';
import QualityGroup from './QualityGroup';
import QualityItem from './QualityItem';
import Dropdown from '../ui/Dropdown';
import { Info } from 'lucide-react';

const QualityDefinitions = ({ data, arrType, onSave, onSync, isSaving }) => {
    const [expandedGroups, setExpandedGroups] = useState({});
    const [localData, setLocalData] = useState({});
    const [viewMode, setViewMode] = useState('mbPerMin');

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

    const viewModeOptions = [
        { value: 'mbPerMin', label: 'Megabytes per minute' },
        { value: 'gbPer20min', label: 'Gigabytes per 20min' },
        { value: 'gbPer30min', label: 'Gigabytes per 30min' },
        { value: 'gbPer40min', label: 'Gigabytes per 40min' },
        { value: 'gbPerHour', label: 'Gigabytes per hour' },
        { value: 'gbPer90min', label: 'Gigabytes per 1h 30min' },
        { value: 'gbPer2hr', label: 'Gigabytes per 2 hours' },
        { value: 'gbPer150min', label: 'Gigabytes per 2h 30min' },
        { value: 'gbPer3hr', label: 'Gigabytes per 3 hours' },
        { value: 'mbps', label: 'Megabits per second' }
    ];

    // Convert MB/min to display value based on view mode
    const convertValue = (mbPerMin) => {
        if (!mbPerMin && mbPerMin !== 0) return 0;
        
        switch (viewMode) {
            case 'gbPer20min':
                return (mbPerMin * 20 / 1024).toFixed(2);
            case 'gbPer30min':
                return (mbPerMin * 30 / 1024).toFixed(2);
            case 'gbPer40min':
                return (mbPerMin * 40 / 1024).toFixed(2);
            case 'gbPerHour':
                return (mbPerMin * 60 / 1024).toFixed(2);
            case 'gbPer90min':
                return (mbPerMin * 90 / 1024).toFixed(2);
            case 'gbPer2hr':
                return (mbPerMin * 120 / 1024).toFixed(2);
            case 'gbPer150min':
                return (mbPerMin * 150 / 1024).toFixed(2);
            case 'gbPer3hr':
                return (mbPerMin * 180 / 1024).toFixed(2);
            case 'mbps':
                return (mbPerMin * 8 / 60).toFixed(1);
            default: // mbPerMin
                return mbPerMin;
        }
    };

    // Convert display value back to MB/min for storage
    const convertBack = (displayValue) => {
        const value = parseFloat(displayValue) || 0;
        
        switch (viewMode) {
            case 'gbPer20min':
                return Math.round(value * 1024 / 20);
            case 'gbPer30min':
                return Math.round(value * 1024 / 30);
            case 'gbPer40min':
                return Math.round(value * 1024 / 40);
            case 'gbPerHour':
                return Math.round(value * 1024 / 60);
            case 'gbPer90min':
                return Math.round(value * 1024 / 90);
            case 'gbPer2hr':
                return Math.round(value * 1024 / 120);
            case 'gbPer150min':
                return Math.round(value * 1024 / 150);
            case 'gbPer3hr':
                return Math.round(value * 1024 / 180);
            case 'mbps':
                return Math.round(value * 60 / 8);
            default: // mbPerMin
                return Math.round(value);
        }
    };

    // Get unit label for current view mode
    const getUnitLabel = () => {
        switch (viewMode) {
            case 'mbPerMin':
                return 'MB/min';
            case 'gbPer20min':
                return 'GB/20min';
            case 'gbPer30min':
                return 'GB/30min';
            case 'gbPer40min':
                return 'GB/40min';
            case 'gbPerHour':
                return 'GB/hr';
            case 'gbPer90min':
                return 'GB/90min';
            case 'gbPer2hr':
                return 'GB/2hr';
            case 'gbPer150min':
                return 'GB/2.5hr';
            case 'gbPer3hr':
                return 'GB/3hr';
            case 'mbps':
                return 'Mbps';
            default:
                return '';
        }
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
            {/* View Mode Selector and Disclaimer */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-start space-x-2 flex-1">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-gray-400">
                        <p>Preferred size is rarely used when combining quality profiles with custom formats.</p>
                        <p className="mt-1">Min/max values are useful for setting absolute limits on what can be grabbed.</p>
                    </div>
                </div>
                <div className="w-full sm:w-56">
                    <Dropdown
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value)}
                        options={viewModeOptions}
                    />
                </div>
            </div>

            <div className="space-y-4">
                {Object.entries(qualityGroups).map(([groupName, qualities]) => (
                    <QualityGroup
                        key={groupName}
                        title={groupName}
                        isExpanded={expandedGroups[groupName]}
                        onToggle={() => toggleGroup(groupName)}
                        unitLabel={getUnitLabel()}
                    >
                        {Object.entries(qualities).map(([qualityName, settings]) => (
                            <QualityItem
                                key={qualityName}
                                name={qualityName}
                                settings={settings}
                                arrType={arrType}
                                viewMode={viewMode}
                                convertValue={convertValue}
                                convertBack={convertBack}
                                onChange={(newSettings) => handleQualityChange(qualityName, newSettings)}
                            />
                        ))}
                    </QualityGroup>
                ))}
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