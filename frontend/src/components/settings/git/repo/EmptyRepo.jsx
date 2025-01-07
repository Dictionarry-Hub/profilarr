import React from 'react';
import {Link, Loader} from 'lucide-react';
import GithubIcon from '@logo/GitHub.svg';
import Tooltip from '@ui/Tooltip';

const EmptyRepo = ({onLinkRepo, loadingAction}) => {
    return (
        <div className='flex items-center space-x-4'>
            <img
                src={GithubIcon}
                alt='GitHub'
                className='w-8 h-8 filter invert'
            />
            <div className='flex-grow'>
                <h2 className='text-lg font-medium text-white'>
                    No Repository Connected
                </h2>
                <p className='text-sm text-gray-400'>
                    Profilarr leverages Git to create an open-source
                    configuration sharing system. Connect to the{' '}
                    <a
                        href='https://github.com/Dictionarry-Hub/database'
                        className='text-blue-500 hover:underline'
                        target='_blank'
                        rel='noopener noreferrer'>
                        Dictionarry Database
                    </a>{' '}
                    or any external database to get started.
                </p>
            </div>
            <Tooltip content='Link Repository'>
                <button
                    onClick={onLinkRepo}
                    className={`flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-200 ease-in-out text-sm font-medium ${
                        loadingAction ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={loadingAction !== ''}>
                    {loadingAction === 'link_repo' ? (
                        <Loader size={16} className='animate-spin mr-2' />
                    ) : (
                        <Link size={16} className='mr-2' />
                    )}
                    Link Repository
                </button>
            </Tooltip>
        </div>
    );
};

export default EmptyRepo;
