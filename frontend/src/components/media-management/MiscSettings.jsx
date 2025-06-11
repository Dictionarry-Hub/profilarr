import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CategoryContainer from './CategoryContainer';

const MiscSettings = ({ data, arrType, onSave, onSync, isSaving }) => {
    const [localData, setLocalData] = useState({
        propersRepacks: 'doNotPrefer',
        enableMediaInfo: true
    });

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

    return (
        <CategoryContainer
            title="Miscellaneous Settings"
            onSync={handleSync}
            onSave={handleSave}
            isSaving={isSaving}
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                        Propers and Repacks
                    </label>
                    <select
                        value={localData.propersRepacks}
                        className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-100 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => handleChange('propersRepacks', e.target.value)}
                    >
                        <option value="preferAndUpgrade">Prefer and Upgrade</option>
                        <option value="doNotUpgrade">Do Not Upgrade</option>
                        <option value="doNotPrefer">Do Not Prefer</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-400">
                        Choose how to handle proper and repack releases
                    </p>
                </div>

                <div>
                    <label className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            checked={localData.enableMediaInfo}
                            onChange={(e) => handleChange('enableMediaInfo', e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-gray-700 dark:bg-gray-700 border-gray-600 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm font-medium text-gray-100 dark:text-gray-100">
                            Enable MediaInfo
                        </span>
                    </label>
                    <p className="ml-7 mt-1 text-xs text-gray-400 dark:text-gray-400">
                        Extract and display media file information
                    </p>
                </div>
            </div>
        </CategoryContainer>
    );
};

MiscSettings.propTypes = {
    data: PropTypes.shape({
        propersRepacks: PropTypes.string,
        enableMediaInfo: PropTypes.bool
    }),
    arrType: PropTypes.oneOf(['radarr', 'sonarr']).isRequired,
    onSave: PropTypes.func,
    onSync: PropTypes.func,
    isSaving: PropTypes.bool
};

export default MiscSettings;