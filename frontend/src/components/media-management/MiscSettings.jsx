import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CategoryContainer from './CategoryContainer';
import Dropdown from '../ui/Dropdown';

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
            title="Miscellaneous"
            onSync={handleSync}
            onSave={handleSave}
            isSaving={isSaving}
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                        Propers and Repacks
                    </label>
                    <Dropdown
                        value={localData.propersRepacks}
                        onChange={(e) => handleChange('propersRepacks', e.target.value)}
                        options={[
                            { value: 'preferAndUpgrade', label: 'Prefer and Upgrade' },
                            { value: 'doNotUpgrade', label: 'Do Not Upgrade' },
                            { value: 'doNotPrefer', label: 'Do Not Prefer' }
                        ]}
                        placeholder="Select option"
                    />
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-400">
                        Choose how to handle proper and repack releases. <span className="font-semibold text-gray-300">Do Not Prefer</span> is needed to allow custom formats to work properly.
                    </p>
                </div>

                <div>
                    <label className="flex items-center space-x-3">
                        <input
                            type="checkbox"
                            checked={localData.enableMediaInfo}
                            onChange={(e) => handleChange('enableMediaInfo', e.target.checked)}
                            className="w-4 h-4 text-blue-400 bg-gray-900/50 border border-gray-700/50 rounded focus:ring-blue-400 focus:ring-1 transition-all duration-200"
                        />
                        <span className="text-sm font-medium text-gray-100 dark:text-gray-100">
                            Analyze video files
                        </span>
                    </label>
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-400">
                        Extract video information such as resolution, runtime and codec information from files.
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