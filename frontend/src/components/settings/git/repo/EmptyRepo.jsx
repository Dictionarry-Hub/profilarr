import React from 'react';
import {Link, Loader} from 'lucide-react';
import GithubIcon from '@logo/GitHub.svg';

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
            <button
                onClick={onLinkRepo}
                className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium'
                disabled={loadingAction !== ''}>
                {loadingAction === 'link_repo' ? (
                    <Loader className="w-4 h-4 animate-spin" />
                ) : (
                    <Link className="w-4 h-4 text-blue-500" />
                )}
                <span>Link Repository</span>
            </button>
        </div>
    );
};

export default EmptyRepo;
