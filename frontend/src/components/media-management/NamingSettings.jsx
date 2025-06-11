import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CategoryContainer from './CategoryContainer';
import MonospaceInput from '../ui/MonospaceInput';
import Dropdown from '../ui/Dropdown';
import { Info } from 'lucide-react';

const NamingSettings = ({ data, arrType, onSave, onSync, isSaving }) => {
    const [localData, setLocalData] = useState({});

    useEffect(() => {
        if (data) {
            setLocalData(data);
        }
    }, [data]);

    const handleChange = (field, value) => {
        setLocalData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = () => {
        onSave && onSave(localData);
    };

    const handleSync = () => {
        onSync && onSync();
    };

    const colonReplacementOptions = arrType === 'radarr'
        ? [
            { value: 'delete', label: 'Delete' },
            { value: 'dash', label: 'Replace with Dash' },
            { value: 'spaceDash', label: 'Replace with Space Dash' },
            { value: 'spaceDashSpace', label: 'Replace with Space Dash Space' },
            { value: 'smart', label: 'Smart Replace' }
          ]
        : [
            { value: 0, label: 'Delete' },
            { value: 1, label: 'Replace with Dash' },
            { value: 2, label: 'Replace with Space Dash' },
            { value: 3, label: 'Replace with Space Dash Space' },
            { value: 4, label: 'Smart Replace' },
            { value: 5, label: 'Custom' }
          ];

    return (
        <CategoryContainer
            title="Naming"
            onSync={handleSync}
            onSave={handleSave}
            isSaving={isSaving}
        >
            <div className="space-y-4">
                <div>
                    <label className="flex items-center space-x-3 mb-4">
                        <input
                            type="checkbox"
                            checked={localData.rename || false}
                            onChange={(e) => handleChange('rename', e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-gray-700 dark:bg-gray-700 border-gray-600 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm font-medium text-gray-100 dark:text-gray-100">
                            Rename {arrType === 'radarr' ? 'Movies' : 'Episodes'}
                        </span>
                    </label>
                </div>

                {arrType === 'radarr' ? (
                    <>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${!localData.rename ? 'text-gray-500' : 'text-gray-300 dark:text-gray-300'}`}>
                                Movie Format
                            </label>
                            <MonospaceInput
                                value={localData.movieFormat || ''}
                                onChange={(e) => handleChange('movieFormat', e.target.value)}
                                disabled={!localData.rename}
                                rows={2}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                                Movie Folder Format
                            </label>
                            <MonospaceInput
                                value={localData.movieFolderFormat || ''}
                                onChange={(e) => handleChange('movieFolderFormat', e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${!localData.rename ? 'text-gray-500' : 'text-gray-300 dark:text-gray-300'}`}>
                                Standard Episode Format
                            </label>
                            <MonospaceInput
                                value={localData.standardEpisodeFormat || ''}
                                onChange={(e) => handleChange('standardEpisodeFormat', e.target.value)}
                                disabled={!localData.rename}
                                rows={2}
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${!localData.rename ? 'text-gray-500' : 'text-gray-300 dark:text-gray-300'}`}>
                                Daily Episode Format
                            </label>
                            <MonospaceInput
                                value={localData.dailyEpisodeFormat || ''}
                                onChange={(e) => handleChange('dailyEpisodeFormat', e.target.value)}
                                disabled={!localData.rename}
                                rows={2}
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${!localData.rename ? 'text-gray-500' : 'text-gray-300 dark:text-gray-300'}`}>
                                Anime Episode Format
                            </label>
                            <MonospaceInput
                                value={localData.animeEpisodeFormat || ''}
                                onChange={(e) => handleChange('animeEpisodeFormat', e.target.value)}
                                disabled={!localData.rename}
                                rows={2}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                                Series Folder Format
                            </label>
                            <MonospaceInput
                                value={localData.seriesFolderFormat || ''}
                                onChange={(e) => handleChange('seriesFolderFormat', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                                Season Folder Format
                            </label>
                            <MonospaceInput
                                value={localData.seasonFolderFormat || ''}
                                onChange={(e) => handleChange('seasonFolderFormat', e.target.value)}
                            />
                        </div>
                    </>
                )}

                <div>
                    <label className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            checked={localData.replaceIllegalCharacters || false}
                            onChange={(e) => handleChange('replaceIllegalCharacters', e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-gray-700 dark:bg-gray-700 border-gray-600 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm font-medium text-gray-100 dark:text-gray-100">
                            Replace Illegal Characters
                        </span>
                    </label>
                </div>

                <div>
                    <label className={`block text-sm font-medium mb-2 ${!localData.replaceIllegalCharacters ? 'text-gray-500' : 'text-gray-300 dark:text-gray-300'}`}>
                        Colon Replacement
                    </label>
                    <Dropdown
                        value={localData.colonReplacementFormat ?? (arrType === 'radarr' ? 'smart' : 0)}
                        onChange={(e) => handleChange('colonReplacementFormat', arrType === 'sonarr' ? parseInt(e.target.value) : e.target.value)}
                        options={colonReplacementOptions}
                        disabled={!localData.replaceIllegalCharacters}
                        placeholder="Select replacement"
                    />
                </div>

                {arrType === 'sonarr' && localData.colonReplacementFormat === 5 && (
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${!localData.replaceIllegalCharacters ? 'text-gray-500' : 'text-gray-300 dark:text-gray-300'}`}>
                            Custom Colon Replacement
                        </label>
                        <MonospaceInput
                            value={localData.customColonReplacementFormat || ''}
                            onChange={(e) => handleChange('customColonReplacementFormat', e.target.value)}
                            placeholder="Enter custom replacement"
                            disabled={!localData.replaceIllegalCharacters}
                        />
                    </div>
                )}

                {arrType === 'sonarr' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                            Multi-Episode Style
                        </label>
                        <Dropdown
                            value={localData.multiEpisodeStyle ?? 0}
                            onChange={(e) => handleChange('multiEpisodeStyle', parseInt(e.target.value))}
                            options={[
                                { value: 0, label: 'Extend' },
                                { value: 1, label: 'Duplicate' },
                                { value: 2, label: 'Repeat' },
                                { value: 3, label: 'Scene' },
                                { value: 4, label: 'Range' },
                                { value: 5, label: 'Prefixed Range' }
                            ]}
                            placeholder="Select style"
                        />
                    </div>
                )}

                {/* Disclaimer */}
                <div className="flex items-start space-x-2 mt-6 pt-4 border-t border-gray-700">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-400">
                        Please ensure all formats follow {arrType === 'radarr' ? 'Radarr' : 'Sonarr'}'s naming requirements. 
                        Profilarr does not validate formats before syncing.
                    </p>
                </div>
            </div>
        </CategoryContainer>
    );
};

NamingSettings.propTypes = {
    data: PropTypes.object,
    arrType: PropTypes.oneOf(['radarr', 'sonarr']).isRequired,
    onSave: PropTypes.func,
    onSync: PropTypes.func,
    isSaving: PropTypes.bool
};

export default NamingSettings;