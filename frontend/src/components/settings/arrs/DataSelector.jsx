import React from 'react';
import {Loader, AlertTriangle} from 'lucide-react';

const DataSelector = ({
    isLoading,
    availableData = {profiles: [], customFormats: []},
    selectedData = {profiles: [], customFormats: []},
    onDataToggle,
    error
}) => {
    const profiles = selectedData?.profiles || [];
    const customFormats = selectedData?.customFormats || [];

    const availableProfileNames = new Set(
        availableData.profiles.map(p => p.content.name)
    );
    const availableFormatNames = new Set(
        availableData.customFormats.map(f => f.content.name)
    );

    const missingProfiles = profiles.filter(
        name => !availableProfileNames.has(name)
    );
    const missingFormats = customFormats.filter(
        name => !availableFormatNames.has(name)
    );

    const renderItem = (name, type, isMissing) => (
        <label
            key={name}
            className={`flex items-center p-2 bg-white dark:bg-gray-800 
        hover:bg-gray-50 dark:hover:bg-gray-700 
        rounded-lg cursor-pointer group transition-colors
        border ${
            isMissing
                ? 'border-amber-500/50 dark:border-amber-500/30'
                : 'border-gray-200 dark:border-gray-700'
        }`}>
            <div className='flex-1 flex items-center'>
                <input
                    type='checkbox'
                    checked={
                        type === 'profiles'
                            ? profiles.includes(name)
                            : customFormats.includes(name)
                    }
                    onChange={() => onDataToggle(type, name)}
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0'
                />
                <span
                    className='ml-3 text-sm text-gray-700 dark:text-gray-300 
            group-hover:text-gray-900 dark:group-hover:text-gray-100 flex-1'>
                    {name}
                </span>
                {isMissing && (
                    <div className='flex items-center text-amber-500 dark:text-amber-400'>
                        <AlertTriangle className='w-4 h-4 mr-1' />
                        <span className='text-xs'>File not found</span>
                    </div>
                )}
            </div>
        </label>
    );

    return (
        <div className='space-y-6'>
            {isLoading ? (
                <div className='flex items-center justify-center py-12'>
                    <Loader className='w-6 h-6 animate-spin text-blue-500' />
                </div>
            ) : (
                <>
                    {/* Quality Profiles Section */}
                    <div className='space-y-3'>
                        <div className='flex items-center justify-between'>
                            <h4 className='text-sm font-medium'>
                                Quality Profiles
                            </h4>
                            <div className='flex items-center space-x-2'>
                                {missingProfiles.length > 0 && (
                                    <span className='text-xs text-amber-500 dark:text-amber-400'>
                                        {missingProfiles.length} missing
                                    </span>
                                )}
                                <span className='text-xs text-gray-500 dark:text-gray-400'>
                                    {profiles.length} selected
                                </span>
                            </div>
                        </div>
                        <div className='grid grid-cols-2 gap-2'>
                            {missingProfiles.map(name =>
                                renderItem(name, 'profiles', true)
                            )}
                            {availableData.profiles.map(profile =>
                                renderItem(
                                    profile.content.name,
                                    'profiles',
                                    false
                                )
                            )}
                        </div>
                    </div>

                    {/* Custom Formats Section */}
                    <div className='space-y-3'>
                        <div className='space-y-1'>
                            <div className='flex items-center justify-between'>
                                <h4 className='text-sm font-medium'>
                                    Custom Formats
                                </h4>
                                <div className='flex items-center space-x-2'>
                                    {missingFormats.length > 0 && (
                                        <span className='text-xs text-amber-500 dark:text-amber-400'>
                                            {missingFormats.length} missing
                                        </span>
                                    )}
                                    <span className='text-xs text-gray-500 dark:text-gray-400'>
                                        {customFormats.length} selected
                                    </span>
                                </div>
                            </div>
                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                                Note: Custom formats used in selected quality
                                profiles are automatically imported and don't
                                need to be selected here.
                            </p>
                        </div>
                        <div className='grid grid-cols-2 gap-2'>
                            {missingFormats.map(name =>
                                renderItem(name, 'customFormats', true)
                            )}
                            {availableData.customFormats.map(format =>
                                renderItem(
                                    format.content.name,
                                    'customFormats',
                                    false
                                )
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className='pt-2'>
                            <p className='text-xs text-red-500'>{error}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default DataSelector;
