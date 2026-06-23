import React from 'react';
import {Info} from 'lucide-react';

const DeprecationBanner = () => {
    return (
        <div className='bg-gray-800/50 border-b border-gray-700'>
            <div className='max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3'>
                <div className='flex items-center gap-3 text-sm text-gray-300'>
                    <Info size={16} className='flex-shrink-0 text-blue-400' />
                    <p>
                        Profilarr v1 is no longer maintained. v2 is a full
                        rewrite and is not compatible with v1. Existing
                        databases and configurations cannot be migrated.{' '}
                        <a
                            href='https://v2.dictionarry.dev/devlogs/profilarr-v2?section=notes'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-400 hover:text-blue-300 underline'>
                            Learn more
                        </a>
                        {' · '}
                        <a
                            href='https://v2.dictionarry.dev/profilarr-setup/installation'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-400 hover:text-blue-300 underline'>
                            Install v2
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DeprecationBanner;
