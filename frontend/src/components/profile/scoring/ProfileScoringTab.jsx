import React from 'react';
import PropTypes from 'prop-types';
import FormatSettings from './FormatSettings';
import UpgradeSettings from './UpgradeSettings';

const ProfileScoringTab = ({
    formats,
    onScoreChange,
    minCustomFormatScore,
    upgradeUntilScore,
    minScoreIncrement,
    onMinScoreChange,
    onUpgradeUntilScoreChange,
    onMinIncrementChange,
    upgradesAllowed,
    onUpgradesAllowedChange
}) => {
    return (
        <div className='w-full space-y-6'>
            {/* Upgrade Settings Section */}
            <div className='space-y-4'>
                <div className='flex justify-between items-start'>
                    <div>
                        <h2 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                            Upgrade Settings
                        </h2>
                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                            Configure when upgrades should be downloaded and
                            what scores are required
                        </p>
                    </div>
                    <div className='flex flex-col items-end space-y-1'>
                        <label className='flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer'>
                            <input
                                type='checkbox'
                                checked={upgradesAllowed}
                                onChange={e =>
                                    onUpgradesAllowedChange(e.target.checked)
                                }
                                className='rounded border-gray-300 dark:border-gray-600 
                                text-blue-500 focus:ring-blue-500 
                                h-4 w-4 cursor-pointer
                                transition-colors duration-200'
                            />
                            <span>Upgrades Allowed</span>
                        </label>
                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                            Allow automatic upgrades for this profile
                        </p>
                    </div>
                </div>

                <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4'>
                    <UpgradeSettings
                        minCustomFormatScore={minCustomFormatScore}
                        upgradeUntilScore={upgradeUntilScore}
                        minScoreIncrement={minScoreIncrement}
                        onMinScoreChange={onMinScoreChange}
                        onUpgradeUntilScoreChange={onUpgradeUntilScoreChange}
                        onMinIncrementChange={onMinIncrementChange}
                        upgradesAllowed={upgradesAllowed}
                    />
                </div>
            </div>

            {/* Format Settings Section */}
            <div className='space-y-4 pb-6'>
                <div>
                    <h2 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                        Format Settings
                    </h2>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                        Customize format scoring to prioritize your preferred downloads. 
                        Use Basic mode for a simple list view with sliders, Advanced mode for 
                        detailed A/V category grids, and Selective mode to display and manage 
                        only formats you care about instead of all available formats.
                    </p>
                </div>

                <FormatSettings
                    formats={formats}
                    onScoreChange={onScoreChange}
                />
            </div>
        </div>
    );
};

ProfileScoringTab.propTypes = {
    formats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            score: PropTypes.number.isRequired,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    onScoreChange: PropTypes.func.isRequired,
    minCustomFormatScore: PropTypes.number.isRequired,
    upgradeUntilScore: PropTypes.number.isRequired,
    minScoreIncrement: PropTypes.number.isRequired,
    onMinScoreChange: PropTypes.func.isRequired,
    onUpgradeUntilScoreChange: PropTypes.func.isRequired,
    onMinIncrementChange: PropTypes.func.isRequired,
    upgradesAllowed: PropTypes.bool.isRequired,
    onUpgradesAllowedChange: PropTypes.func.isRequired
};

export default ProfileScoringTab;
