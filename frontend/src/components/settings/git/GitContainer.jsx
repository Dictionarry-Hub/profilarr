import React, {useState, useEffect} from 'react';
import {Loader} from 'lucide-react';
import {
    getSettings,
    getGitStatus,
    addFiles,
    unstageFiles,
    commitFiles,
    pushFiles,
    revertFile,
    pullBranch
} from '@api/api';
import Alert from '@ui/Alert';
import {statusLoadingMessages, getRandomMessage} from '@constants/messages';
import RepoContainer from './repo/RepoContainer';
import StatusContainer from './status/StatusContainer';

const GitContainer = () => {
    const [settings, setSettings] = useState(null);
    const [changes, setChanges] = useState(null);
    const [loadingAction, setLoadingAction] = useState('');
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusLoadingMessage, setStatusLoadingMessage] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const fetchedSettings = await getSettings();
            if (fetchedSettings && fetchedSettings.gitRepo) {
                setSettings(fetchedSettings);
                await fetchGitStatus();
            } else {
                setSettings(null);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const fetchGitStatus = async () => {
        setStatusLoading(true);
        setStatusLoadingMessage(getRandomMessage(statusLoadingMessages));

        try {
            const result = await getGitStatus();
            if (result.success) {
                const gitStatus = {
                    ...result.data,
                    outgoing_changes: Array.isArray(
                        result.data.outgoing_changes
                    )
                        ? result.data.outgoing_changes
                        : [],
                    incoming_changes: Array.isArray(
                        result.data.incoming_changes
                    )
                        ? result.data.incoming_changes
                        : [],
                    merge_conflicts: Array.isArray(result.data.merge_conflicts)
                        ? result.data.merge_conflicts
                        : []
                };

                setChanges(gitStatus);
            }
        } catch (error) {
            console.error('Error fetching Git status:', error);
            Alert.error('Failed to fetch Git status');
        } finally {
            setStatusLoading(false);
        }
    };

    const handleStageSelectedChanges = async selectedChanges => {
        setLoadingAction('stage_selected');
        try {
            const response = await addFiles(selectedChanges);
            if (response.success) {
                await fetchGitStatus();
                Alert.success(response.message);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            Alert.error('An unexpected error occurred while staging changes.');
            console.error('Error staging changes:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const handleUnstageSelectedChanges = async selectedChanges => {
        setLoadingAction('unstage_selected');
        try {
            const response = await unstageFiles(selectedChanges);
            if (response.success) {
                await fetchGitStatus();
                Alert.success(response.message);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            Alert.error(
                'An unexpected error occurred while unstaging changes.'
            );
            console.error('Error unstaging changes:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const handleCommitSelectedChanges = async (
        selectedChanges,
        commitMessage
    ) => {
        setLoadingAction('commit_selected');
        try {
            const response = await commitFiles(selectedChanges, commitMessage);
            if (response.success) {
                await fetchGitStatus();
                Alert.success(response.message);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            Alert.error(
                'An unexpected error occurred while committing changes.'
            );
            console.error('Error committing changes:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const handlePushChanges = async () => {
        setLoadingAction('push_changes');
        try {
            const response = await pushFiles();
            if (response.success) {
                await fetchGitStatus();
                Alert.success(
                    response.message || 'Successfully pushed changes'
                );
            } else {
                Alert.error(
                    typeof response.error === 'string'
                        ? response.error
                        : response.error?.error || 'Failed to push changes'
                );
            }
        } catch (error) {
            console.error('handlePushChanges error:', error);
            Alert.error('An unexpected error occurred while pushing changes.');
        } finally {
            setLoadingAction('');
        }
    };

    const handlePullSelectedChanges = async () => {
        setLoadingAction('pull_changes');
        try {
            const response = await pullBranch(changes.branch);
            await fetchGitStatus();

            if (response.success) {
                if (response.state === 'resolve') {
                    Alert.info(
                        response.message ||
                            'Repository is now in conflict resolution state.',
                        {autoClose: true, closeOnClick: true}
                    );
                } else {
                    Alert.success(
                        response.message || 'Successfully pulled changes'
                    );
                }
            } else {
                Alert.error(response.message || 'Failed to pull changes');
            }
        } catch (error) {
            console.error('Error in pullBranch:', error);
            Alert.error('Failed to pull changes');
        } finally {
            setLoadingAction('');
        }
    };

    const handleRevertSelectedChanges = async selectedChanges => {
        setLoadingAction('revert_selected');
        try {
            const response = await Promise.all(
                selectedChanges.map(filePath => revertFile(filePath))
            );
            const allSuccessful = response.every(res => res.success);
            if (allSuccessful) {
                await fetchGitStatus();
                Alert.success(
                    'Selected changes have been reverted successfully.'
                );
            } else {
                Alert.error(
                    'Some changes could not be reverted. Please try again.'
                );
            }
        } catch (error) {
            Alert.error(
                'An unexpected error occurred while reverting changes.'
            );
            console.error('Error reverting changes:', error);
        } finally {
            setLoadingAction('');
        }
    };

    return (
        <>
            <RepoContainer
                settings={settings}
                status={changes}
                fetchGitStatus={fetchGitStatus}
                setSettings={setSettings}
                loadingAction={loadingAction}
            />

            {settings && (
                <div className='space-y-4'>
                    {statusLoading ? (
                        <div className='flex items-left justify-left dark:bg-gray-800 p-4 rounded-md border border-gray-200 dark:border-gray-700 text-sm'>
                            <Loader className='animate-spin mr-2' size={16} />
                            <span className='text-gray-300'>
                                {statusLoadingMessage}
                            </span>
                        </div>
                    ) : (
                        <StatusContainer
                            status={changes}
                            settings={settings}
                            onStageSelected={handleStageSelectedChanges}
                            onUnstageSelected={handleUnstageSelectedChanges}
                            onCommitSelected={handleCommitSelectedChanges}
                            onPushSelected={handlePushChanges}
                            onRevertSelected={handleRevertSelectedChanges}
                            onPullSelected={handlePullSelectedChanges}
                            fetchGitStatus={fetchGitStatus}
                            loadingAction={loadingAction}
                        />
                    )}
                </div>
            )}
        </>
    );
};

export default GitContainer;
