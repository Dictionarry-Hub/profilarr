import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CategoryContainer from './CategoryContainer';

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
            title="Naming Settings"
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
                            <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                                Movie Format
                            </label>
                            <textarea
                                value={localData.movieFormat || ''}
                                onChange={(e) => handleChange('movieFormat', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                rows={2}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                                Movie Folder Format
                            </label>
                            <input
                                type="text"
                                value={localData.movieFolderFormat || ''}
                                onChange={(e) => handleChange('movieFolderFormat', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                                Standard Episode Format
                            </label>
                            <textarea
                                value={localData.standardEpisodeFormat || ''}
                                onChange={(e) => handleChange('standardEpisodeFormat', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                rows={2}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                                Daily Episode Format
                            </label>
                            <textarea
                                value={localData.dailyEpisodeFormat || ''}
                                onChange={(e) => handleChange('dailyEpisodeFormat', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                rows={2}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                                Anime Episode Format
                            </label>
                            <textarea
                                value={localData.animeEpisodeFormat || ''}
                                onChange={(e) => handleChange('animeEpisodeFormat', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                rows={2}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                                Series Folder Format
                            </label>
                            <input
                                type="text"
                                value={localData.seriesFolderFormat || ''}
                                onChange={(e) => handleChange('seriesFolderFormat', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                                Season Folder Format
                            </label>
                            <input
                                type="text"
                                value={localData.seasonFolderFormat || ''}
                                onChange={(e) => handleChange('seasonFolderFormat', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
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
                    <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                        Colon Replacement
                    </label>
                    <select
                        value={localData.colonReplacementFormat || (arrType === 'radarr' ? 'smart' : 4)}
                        onChange={(e) => handleChange('colonReplacementFormat', arrType === 'sonarr' ? parseInt(e.target.value) : e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {colonReplacementOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {arrType === 'sonarr' && localData.colonReplacementFormat === 5 && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                            Custom Colon Replacement
                        </label>
                        <input
                            type="text"
                            value={localData.customColonReplacementFormat || ''}
                            onChange={(e) => handleChange('customColonReplacementFormat', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter custom replacement"
                        />
                    </div>
                )}

                {arrType === 'sonarr' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                            Multi-Episode Style
                        </label>
                        <select
                            value={localData.multiEpisodeStyle || 5}
                            onChange={(e) => handleChange('multiEpisodeStyle', parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={0}>Extend</option>
                            <option value={1}>Duplicate</option>
                            <option value={2}>Repeat</option>
                            <option value={3}>Scene</option>
                            <option value={4}>Range</option>
                            <option value={5}>Prefixed Range</option>
                        </select>
                    </div>
                )}
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