import React from 'react';
import PropTypes from 'prop-types';
import NumberInput from '@ui/NumberInput';

const UpgradeSettings = ({
    minCustomFormatScore,
    upgradeUntilScore,
    minScoreIncrement,
    onMinScoreChange,
    onUpgradeUntilScoreChange,
    onMinIncrementChange,
    upgradesAllowed
}) => {
    return (
        <div>
            <div className='space-y-6'>
                {/* Minimum Custom Format Score - Always visible */}
                <div className='flex items-center justify-between'>
                    <div className='space-y-1'>
                        <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                            Minimum Custom Format Score
                        </label>
                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                            Minimum custom format score allowed to download
                        </p>
                    </div>
                    <NumberInput
                        value={minCustomFormatScore}
                        onChange={onMinScoreChange}
                    />
                </div>

                {/* Conditional settings that only show when upgrades are allowed */}
                {upgradesAllowed && (
                    <>
                        {/* Upgrade Until Score */}
                        <div className='flex items-center justify-between'>
                            <div className='space-y-1'>
                                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                                    Upgrade Until Custom Format Score
                                </label>
                                <p className='text-xs text-gray-500 dark:text-gray-400'>
                                    Once the quality cutoff is met or exceeded
                                    and this custom format score is reached, no
                                    more upgrades will be grabbed
                                </p>
                            </div>
                            <NumberInput
                                value={upgradeUntilScore}
                                onChange={onUpgradeUntilScoreChange}
                                min={0}
                            />
                        </div>

                        {/* Minimum Score Increment */}
                        <div className='flex items-center justify-between'>
                            <div className='space-y-1'>
                                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                                    Minimum Custom Format Score Increment
                                </label>
                                <p className='text-xs text-gray-500 dark:text-gray-400'>
                                    Minimum required improvement of the custom
                                    format score between existing and new
                                    releases before considering an upgrade
                                </p>
                            </div>
                            <NumberInput
                                value={minScoreIncrement}
                                onChange={onMinIncrementChange}
                                min={0}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

UpgradeSettings.propTypes = {
    minCustomFormatScore: PropTypes.number.isRequired,
    upgradeUntilScore: PropTypes.number.isRequired,
    minScoreIncrement: PropTypes.number.isRequired,
    onMinScoreChange: PropTypes.func.isRequired,
    onUpgradeUntilScoreChange: PropTypes.func.isRequired,
    onMinIncrementChange: PropTypes.func.isRequired,
    upgradesAllowed: PropTypes.bool.isRequired
};

export default UpgradeSettings;
