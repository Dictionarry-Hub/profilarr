import React, { useState, useEffect, useRef } from 'react';
import {
    getSettings,
    getGitStatus,
    addFiles,
    pushFiles,
    revertFile,
    pullBranch,
    checkDevMode
} from '../../api/api';
import {
    Loader,
} from 'lucide-react';
import ViewBranches from './git/modal/ViewBranches';
import Alert from '../ui/Alert';
import ArrContainer from './arrs/ArrContainer';
import RepoContainer from './git/RepoContainer';
import StatusContainer from './git/StatusContainer';
import { statusLoadingMessages, noChangesMessages, getRandomMessage } from '../../utils/messages';

const SettingsPage = () => {
    const [settings, setSettings] = useState(null);
    const [changes, setChanges] = useState(null);
    const [isDevMode, setIsDevMode] = useState(false);
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [loadingAction, setLoadingAction] = useState('');
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusLoadingMessage, setStatusLoadingMessage] = useState('');
    const [noChangesMessage, setNoChangesMessage] = useState('');
    const [activeTab, setActiveTab] = useState('git');  // New state for tab navigation
    const tabsRef = useRef({});  // Ref for tabs

    useEffect(() => {
        fetchSettings();
        checkDevModeStatus();
    }, []);

    const checkDevModeStatus = async () => {
        try {
            const response = await checkDevMode();
            setIsDevMode(response.devMode);
        } catch (error) {
            console.error('Error checking dev mode:', error);
            setIsDevMode(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const fetchedSettings = await getSettings();
            setSettings(fetchedSettings);
            if (fetchedSettings) {
                await fetchGitStatus();
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const fetchGitStatus = async () => {
        setStatusLoading(true);
        setStatusLoadingMessage(getRandomMessage(statusLoadingMessages));
        setNoChangesMessage(getRandomMessage(noChangesMessages));
        try {
            const result = await getGitStatus();
            if (result.success) {
                setChanges({
                    ...result.data,
                    outgoing_changes: Array.isArray(result.data.outgoing_changes)
                        ? result.data.outgoing_changes
                        : [],
                    incoming_changes: Array.isArray(result.data.incoming_changes)
                        ? result.data.incoming_changes
                        : []
                });
            }
        } catch (error) {
            console.error('Error fetching Git status:', error);
            Alert.error('Failed to fetch Git status');
        } finally {
            setStatusLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    const handleStageSelectedChanges = async (selectedChanges) => {
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

    const handleCommitSelectedChanges = async (selectedChanges, commitMessage) => {
        setLoadingAction('commit_selected');
        try {
            const response = await pushFiles(selectedChanges, commitMessage);
            if (response.success) {
                await fetchGitStatus();
                Alert.success(response.message);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            Alert.error('An unexpected error occurred while committing changes.');
            console.error('Error committing changes:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const handleRevertSelectedChanges = async (selectedChanges) => {
        setLoadingAction('revert_selected');
        try {
            const response = await Promise.all(selectedChanges.map(filePath => revertFile(filePath)));
            const allSuccessful = response.every(res => res.success);
            if (allSuccessful) {
                await fetchGitStatus();
                Alert.success('Selected changes have been reverted successfully.');
            } else {
                Alert.error('Some changes could not be reverted. Please try again.');
            }
        } catch (error) {
            Alert.error('An unexpected error occurred while reverting changes.');
            console.error('Error reverting changes:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const handlePullSelectedChanges = async (selectedChanges) => {
        setLoadingAction('pull_changes');
        try {
            const response = await pullBranch(changes.branch, selectedChanges);
            if (response.success) {
                await fetchGitStatus();
                Alert.success(response.message);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            Alert.error('An unexpected error occurred while pulling changes.');
            console.error('Error pulling changes:', error);
        } finally {
            setLoadingAction('');
        }
    };

    return (
        <div>
            <nav className="flex space-x-4">
                <div
                    onClick={() => handleTabChange('git')}
                    ref={(el) => (tabsRef.current['git'] = el)}
                    className={`cursor-pointer px-3 py-2 rounded-md text-sm font-medium mb-4 ${
                        activeTab === 'git' ? 'text-white dark:bg-gray-600 border border-gray-200 dark:border-gray-600' : 'text-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                    }`}
                >
                    Git Settings
                </div>
                <div
                    onClick={() => handleTabChange('app')}
                    ref={(el) => (tabsRef.current['app'] = el)}
                    className={`cursor-pointer px-3 py-2 rounded-md text-sm font-medium mb-4 ${
                        activeTab === 'app' ? 'text-white dark:bg-gray-600 border border-gray-200 dark:border-gray-600' : 'text-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                    }`}
                >
                    App Settings
                </div>
            </nav>

            {activeTab === 'git' && (
                <>

                    <RepoContainer
                        settings={settings}
                        setSettings={setSettings}
                        fetchGitStatus={fetchGitStatus}
                    />

                    {settings && (
                        <div className="space-y-4">
                            {statusLoading ? (
                                <div className="flex items-left justify-left dark:bg-gray-800 p-4 rounded-md border border-gray-200 dark:border-gray-700 text-sm">
                                    <Loader className="animate-spin mr-2" size={16} />
                                    <span className="text-gray-300">{statusLoadingMessage}</span>
                                </div>
                            ) :  (
                                <StatusContainer
                                    status={changes}
                                    isDevMode={isDevMode}
                                    onViewBranches={() => setShowBranchModal(true)}
                                    onStageSelected={handleStageSelectedChanges}
                                    onCommitSelected={handleCommitSelectedChanges}
                                    onRevertSelected={handleRevertSelectedChanges}
                                    onPullSelected={handlePullSelectedChanges}
                                    loadingAction={loadingAction}
                                />
                            )}
                        </div>
                    )}

                    {settings && changes && (
                        <ViewBranches
                            isOpen={showBranchModal}
                            onClose={() => setShowBranchModal(false)}
                            repoUrl={settings.gitRepo}
                            currentBranch={changes.branch}
                            onBranchChange={fetchGitStatus}
                            isDevMode={isDevMode}
                        />
                    )}
                </>
            )}

            {activeTab === 'app' && (
                <>
                    <h2 className="text-xl font-bold mb-4 text-gray-100 mt-3">
                        App Settings
                    </h2>
                    <ArrContainer />
                </>
            )}
        </div>
    );
};

export default SettingsPage;
