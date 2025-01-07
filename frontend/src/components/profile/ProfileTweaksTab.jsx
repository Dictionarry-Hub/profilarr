import React from 'react';
import PropTypes from 'prop-types';
import {InfoIcon, AlertTriangle} from 'lucide-react';

const ProfileTweaksTab = ({tweaks, onTweaksChange}) => {
    const handleTweakChange = key => {
        onTweaksChange({
            ...tweaks,
            [key]: !tweaks[key]
        });
    };

    return (
        <div className='h-full flex flex-col'>
            <div className='mt-4 space-y-4'>
                <div className='flex gap-2 p-3 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg'>
                    <InfoIcon className='h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0' />
                    <p className='text-blue-700 dark:text-blue-300'>
                        Tweaks are custom changes that can be toggled according
                        to your preference. These settings are profile-specific
                        and won't create merge conflicts when synchronizing with
                        remote repositories. Use tweaks to fine-tune your
                        profile's behavior without affecting the core
                        configuration.
                    </p>
                </div>

                <div className='space-y-2'>
                    {/* Allow Dolby Vision without Fallback */}
                    <div
                        onClick={() => handleTweakChange('allowDVNoFallback')}
                        className={`
                            p-4 rounded-lg cursor-pointer select-none
                            border transition-colors duration-200
                            ${
                                tweaks.allowDVNoFallback
                                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                            }
                            hover:border-blue-500 dark:hover:border-blue-400
                        `}>
                        <div className='space-y-1'>
                            <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                                Allow Dolby Vision without Fallback
                            </h3>
                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                                Allow Dolby Vision releases that don't include
                                HDR10 fallback. These may display incorrectly on
                                non-Dolby Vision displays.
                            </p>
                            <div className='flex items-center gap-1.5 mt-2'>
                                <AlertTriangle className='h-3 w-3 text-amber-500' />
                                <p className='text-[10px] text-amber-600 dark:text-amber-400'>
                                    Only enable if your display supports Dolby
                                    Vision
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Allow Bleeding Edge Codecs */}
                    <div
                        onClick={() =>
                            handleTweakChange('allowBleedingEdgeCodecs')
                        }
                        className={`
                            p-4 rounded-lg cursor-pointer select-none
                            border transition-colors duration-200
                            ${
                                tweaks.allowBleedingEdgeCodecs
                                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                            }
                            hover:border-blue-500 dark:hover:border-blue-400
                        `}>
                        <div className='space-y-1'>
                            <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                                Allow Bleeding Edge Codecs
                            </h3>
                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                                Allow releases using newer codecs like AV1 and
                                H.266/VVC. These may offer better compression
                                but have limited hardware support.
                            </p>
                        </div>
                    </div>

                    {/* Allow Lossless Audio */}
                    <div
                        onClick={() => handleTweakChange('allowLosslessAudio')}
                        className={`
                            p-4 rounded-lg cursor-pointer select-none
                            border transition-colors duration-200
                            ${
                                tweaks.allowLosslessAudio ?? true
                                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                            }
                            hover:border-blue-500 dark:hover:border-blue-400
                        `}>
                        <div className='space-y-1'>
                            <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                                Allow Lossless Audio
                            </h3>
                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                                Allow high-quality lossless audio formats
                                including TrueHD + Atmos, DTS-HD MA, DTS-X,
                                FLAC, and PCM.
                            </p>
                            <div className='flex items-center gap-1.5 mt-2'>
                                <AlertTriangle className='h-3 w-3 text-amber-500' />
                                <p className='text-[10px] text-amber-600 dark:text-amber-400'>
                                    May skip better quality releases if disabled
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Allow Prereleases */}
                    <div
                        onClick={() => handleTweakChange('allowPrereleases')}
                        className={`
                            p-4 rounded-lg cursor-pointer select-none
                            border transition-colors duration-200
                            ${
                                tweaks.allowPrereleases
                                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                            }
                            hover:border-blue-500 dark:hover:border-blue-400
                        `}>
                        <div className='space-y-1'>
                            <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                                Allow Prereleases
                            </h3>
                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                                Allow early releases like CAMs, Telecines,
                                Telesyncs, and Screeners. These are typically
                                available before official releases but at lower
                                quality.
                            </p>
                        </div>
                    </div>

                    {/* Prefer Freeleech */}
                    <div
                        onClick={() => handleTweakChange('preferFreeleech')}
                        className={`
                            p-4 rounded-lg cursor-pointer select-none
                            border transition-colors duration-200
                            ${
                                tweaks.preferFreeleech
                                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                            }
                            hover:border-blue-500 dark:hover:border-blue-400
                        `}>
                        <div className='space-y-1'>
                            <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                                Prefer Freeleech
                            </h3>
                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                                Prioritize releases tagged as freeleech when
                                choosing between different indexers' releases.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

ProfileTweaksTab.propTypes = {
    tweaks: PropTypes.object.isRequired,
    onTweaksChange: PropTypes.func.isRequired
};

export default ProfileTweaksTab;
