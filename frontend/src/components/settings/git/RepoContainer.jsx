import React, { useState } from 'react';
import { Loader, Unlink, Link } from 'lucide-react';
import Tooltip from '../../ui/Tooltip';
import { unlinkRepo, getSettings } from '../../../api/api';
import Alert from '../../ui/Alert';
import LinkRepo from './modal/LinkRepo';
import UnlinkRepo from './modal/UnlinkRepo';

const RepoContainer = ({ settings, setSettings, fetchGitStatus }) => {
    const [loadingAction, setLoadingAction] = useState('');
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showUnlinkRepo, setShowUnlinkRepo] = useState(false);

    const handleLinkRepo = () => {
        setLoadingAction('link_repo');
        setShowLinkModal(true);
    };

    const handleUnlinkRepo = async (removeFiles) => {
        setLoadingAction('unlink_repo');
        try {
            const response = await unlinkRepo(removeFiles);
            if (response.success) {
                setSettings(null);
                Alert.success('Repository unlinked successfully');
                setShowUnlinkRepo(false);
            } else {
                Alert.error(response.error || 'Failed to unlink repository');
            }
        } catch (error) {
            Alert.error(
                'An unexpected error occurred while unlinking the repository'
            );
            console.error('Error unlinking repository:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const onLinkSubmit = async () => {
        setLoadingAction('');
        setShowLinkModal(false);
        const fetchedSettings = await getSettings();
        setSettings(fetchedSettings);
        if (fetchedSettings) {
            await fetchGitStatus();
        }
    };

    // Handler to close the LinkRepo modal and reset loadingAction
    const closeLinkModal = () => {
        setShowLinkModal(false);
        setLoadingAction('');
    };

    // Handler to close the UnlinkRepo modal and reset loadingAction
    const closeUnlinkModal = () => {
        setShowUnlinkRepo(false);
        setLoadingAction('');
    };

    return (
        <div className='space-y-4 mb-4'>
            <div className='dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-lg shadow-md'>
                <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0'>
                    <div className='flex flex-col sm:flex-row sm:items-center'>
                        <h3 className='text-sm font-semibold text-gray-100 mr-2 mb-1 sm:mb-0'>
                            {settings ? 'Connected Repository:' : 'Repository:'}
                        </h3>
                        {settings ? (
                            <a
                                href={settings.gitRepo}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium truncate max-w-xs sm:max-w-md'>
                                {settings.gitRepo}
                            </a>
                        ) : (
                            <span className='text-gray-400 text-sm'>No repository linked</span>
                        )}
                    </div>
                    <Tooltip content={settings ? 'Unlink Repository' : 'Link Repository'}>
                        <button
                            onClick={settings ? () => setShowUnlinkRepo(true) : handleLinkRepo}
                            className={`flex items-center px-4 py-2 ${settings ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md transition-colors duration-200 ease-in-out text-sm font-medium shadow-sm`}
                            disabled={loadingAction !== ''}>
                            {settings ? (
                                <Unlink size={16} className='mr-2' />
                            ) : (
                                <Link size={16} className='mr-2' />
                            )}
                            {settings ? 'Unlink' : 'Link Repository'}
                        </button>
                    </Tooltip>
                </div>
            </div>
            <LinkRepo
                isOpen={showLinkModal}
                onClose={closeLinkModal}
                onSubmit={onLinkSubmit}
            />
            <UnlinkRepo
                isOpen={showUnlinkRepo}
                onClose={closeUnlinkModal}
                onSubmit={handleUnlinkRepo}
            />
        </div>
    );
};

export default RepoContainer;
