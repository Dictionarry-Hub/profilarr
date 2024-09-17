import React from 'react';
import {Loader, Unlink} from 'lucide-react';
import Tooltip from '../../ui/Tooltip';

const RepoContainer = ({settings, loadingAction, onLinkRepo, onUnlinkRepo}) => {
    if (!settings) {
        return (
            <button
                onClick={onLinkRepo}
                className='flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 ease-in-out text-xs'>
                Link Repository
            </button>
        );
    }

    return (
        <div className='space-y-4 mb-4'>
            <div className='dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-md'>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center'>
                        <h3 className='text-sm font-semibold text-gray-100 mr-2'>
                            Connected Repository:
                        </h3>
                        <a
                            href={settings.gitRepo}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-400 hover:text-blue-300 transition-colors text-sm truncate max-w-xs'>
                            {settings.gitRepo}
                        </a>
                    </div>
                    <Tooltip content='Unlink Repository'>
                        <button
                            onClick={onUnlinkRepo}
                            className='flex items-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 ease-in-out text-xs'
                            disabled={loadingAction === 'unlink_repo'}>
                            {loadingAction === 'unlink_repo' ? (
                                <Loader size={14} className='animate-spin' />
                            ) : (
                                <Unlink size={14} className='mr-2' />
                            )}
                            Unlink
                        </button>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
};

export default RepoContainer;
