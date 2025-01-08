import React from 'react';
import {Loader} from 'lucide-react';
import Modal from '@ui/Modal';

const DataSelectorModal = ({
    isOpen,
    onClose,
    isLoading,
    availableData = {profiles: [], customFormats: []},
    selectedData = {profiles: [], customFormats: []},
    onDataToggle,
    error
}) => {
    // Ensure we have safe defaults for selectedData
    const profiles = selectedData?.profiles || [];
    const customFormats = selectedData?.customFormats || [];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title='Select Data to Sync'
            height='2xl'
            width='2xl'>
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
                                <span className='text-xs text-gray-500 dark:text-gray-400'>
                                    {profiles.length} selected
                                </span>
                            </div>
                            <div className='grid grid-cols-2 gap-2'>
                                {(availableData?.profiles || []).map(
                                    profile => (
                                        <label
                                            key={profile.file_name}
                                            className='flex items-center p-2 bg-white dark:bg-gray-800 
                                                 hover:bg-gray-50 dark:hover:bg-gray-700 
                                                 rounded-lg cursor-pointer group transition-colors
                                                 border border-gray-200 dark:border-gray-700'>
                                            <input
                                                type='checkbox'
                                                checked={profiles.includes(
                                                    profile.content.name
                                                )}
                                                onChange={() =>
                                                    onDataToggle(
                                                        'profiles',
                                                        profile.content.name
                                                    )
                                                }
                                                className='rounded border-gray-300 text-blue-600 
                                                     focus:ring-blue-500 focus:ring-offset-0'
                                            />
                                            <span
                                                className='ml-3 text-sm text-gray-700 dark:text-gray-300 
                                                     group-hover:text-gray-900 dark:group-hover:text-gray-100'>
                                                {profile.content.name}
                                            </span>
                                        </label>
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
                                    <span className='text-xs text-gray-500 dark:text-gray-400'>
                                        {customFormats.length} selected
                                    </span>
                                </div>
                                <p className='text-xs text-gray-500 dark:text-gray-400'>
                                    Note: Custom formats used in selected
                                    quality profiles are automatically imported
                                    and don't need to be selected here.
                                </p>
                            </div>
                            <div className='grid grid-cols-2 gap-2'>
                                {(availableData?.customFormats || []).map(
                                    format => (
                                        <label
                                            key={format.file_name}
                                            className='flex items-center p-2 bg-white dark:bg-gray-800 
                                                 hover:bg-gray-50 dark:hover:bg-gray-700 
                                                 rounded-lg cursor-pointer group transition-colors
                                                 border border-gray-200 dark:border-gray-700'>
                                            <input
                                                type='checkbox'
                                                checked={customFormats.includes(
                                                    format.content.name
                                                )}
                                                onChange={() =>
                                                    onDataToggle(
                                                        'customFormats',
                                                        format.content.name
                                                    )
                                                }
                                                className='rounded border-gray-300 text-blue-600 
                                                     focus:ring-blue-500 focus:ring-offset-0'
                                            />
                                            <span
                                                className='ml-3 text-sm text-gray-700 dark:text-gray-300 
                                                     group-hover:text-gray-900 dark:group-hover:text-gray-100'>
                                                {format.content.name}
                                            </span>
                                        </label>
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
        </Modal>
    );
};

export default DataSelectorModal;
