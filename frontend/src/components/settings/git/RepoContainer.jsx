import React, {useState} from 'react';
import {Loader, Unlink, Link} from 'lucide-react';
import Tooltip from '../../ui/Tooltip';
import {unlinkRepo, getSettings} from '../../../api/api';
import Alert from '../../ui/Alert';
import LinkRepo from './modal/LinkRepo';
import UnlinkRepo from './modal/UnlinkRepo';

const RepoContainer = ({settings, setSettings, fetchGitStatus}) => {
    const [loadingAction, setLoadingAction] = useState('');
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showUnlinkRepo, setShowUnlinkRepo] = useState(false);

    const handleLinkRepo = async () => {
        setLoadingAction('link_repo');
        setShowLinkModal(true);
    };

    const handleUnlinkRepo = async removeFiles => {
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

    if (!settings) {
        return (
            <>
                <button
                    onClick={handleLinkRepo}
                    className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 ease-in-out text-sm font-medium shadow-md'>
                    <Link size={16} className='mr-2' />
                    Link Repository
                </button>
                <LinkRepo
                    isOpen={showLinkModal}
                    onClose={() => setShowLinkModal(false)}
                    onSubmit={onLinkSubmit}
                />
            </>
        );
    }

    return (
        <div className='space-y-4 mb-4'>
            <div className='dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-lg shadow-md'>
                <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0'>
                    <div className='flex flex-col sm:flex-row sm:items-center'>
                        <h3 className='text-sm font-semibold text-gray-100 mr-2 mb-1 sm:mb-0'>
                            Connected Repository:
                        </h3>
                        <a
                            href={settings.gitRepo}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium truncate max-w-xs sm:max-w-md'>
                            {settings.gitRepo}
                        </a>
                    </div>
                    <Tooltip content='Unlink Repository'>
                        <button
                            onClick={() => setShowUnlinkRepo(true)}
                            className='flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 ease-in-out text-sm font-medium shadow-sm'
                            disabled={loadingAction === 'unlink_repo'}>
                            {loadingAction === 'unlink_repo' ? (
                                <Loader
                                    size={16}
                                    className='animate-spin mr-2'
                                />
                            ) : (
                                <Unlink size={16} className='mr-2' />
                            )}
                            Unlink
                        </button>
                    </Tooltip>
                </div>
            </div>
            <UnlinkRepo
                isOpen={showUnlinkRepo}
                onClose={() => setShowUnlinkRepo(false)}
                onSubmit={handleUnlinkRepo}
            />
        </div>
    );
};

export default RepoContainer;
