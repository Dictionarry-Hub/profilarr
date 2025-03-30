import React, {useState, useEffect} from 'react';
import {unlinkRepo, getSettings} from '@api/api';
import Alert from '@ui/Alert';
import LinkRepo from './LinkRepo';
import UnlinkRepo from './UnlinkRepo';
import ViewBranches from './ViewBranches';
import ViewCommits from './ViewCommits';
import EmptyRepo from './EmptyRepo';
import ActiveRepo from './ActiveRepo';

const RepoContainer = ({settings, setSettings, fetchGitStatus, status}) => {
    const [loadingAction, setLoadingAction] = useState('');
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showUnlinkModal, setShowUnlinkModal] = useState(false);
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [showCommitModal, setShowCommitModal] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [repoStats, setRepoStats] = useState(null);

    const getRepoFullName = url => {
        if (!url) return '';
        const parts = url.split('/');
        const repo = parts[parts.length - 1].replace('.git', '');
        const org = parts[parts.length - 2];
        return org === 'Dictionarry-Hub'
            ? 'Dictionarry / Database'
            : `${org}/${repo}`;
    };

    const getFirstLetter = () => {
        if (!settings?.gitRepo) return '';
        const parts = settings.gitRepo.split('/');
        return parts[parts.length - 1].charAt(0).toUpperCase();
    };

    const getAvatarColor = repoName => {
        const colors = [
            'bg-blue-600',
            'bg-purple-600',
            'bg-green-600',
            'bg-red-600',
            'bg-indigo-600'
        ];
        const index = repoName
            .split('')
            .reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[index % colors.length];
    };

    useEffect(() => {
        const fetchAvatarAndStats = async () => {
            if (!settings?.gitRepo) return;

            // Get the raw owner/repo for API calls
            const parts = settings.gitRepo.split('/');
            const owner = parts[parts.length - 2];
            const repo = parts[parts.length - 1].replace('.git', '');

            const avatarCacheKey = `github-avatar-${owner}`;
            const statsCacheKey = `github-stats-${owner}/${repo}`;

            const cachedAvatar = localStorage.getItem(avatarCacheKey);
            const cachedStats = localStorage.getItem(statsCacheKey);
            const avatarTimestamp = localStorage.getItem(
                `${avatarCacheKey}-timestamp`
            );
            const statsTimestamp = localStorage.getItem(
                `${statsCacheKey}-timestamp`
            );

            const isAvatarValid =
                avatarTimestamp &&
                Date.now() - parseInt(avatarTimestamp) < 24 * 60 * 60 * 1000;
            const isStatsValid =
                statsTimestamp &&
                Date.now() - parseInt(statsTimestamp) < 1 * 60 * 60 * 1000;

            if (cachedAvatar && isAvatarValid) {
                setAvatarUrl(cachedAvatar);
            }

            if (cachedStats && isStatsValid) {
                setRepoStats(JSON.parse(cachedStats));
            }

            try {
                // Try to fetch the avatar if needed
                if (!isAvatarValid) {
                    try {
                        const avatarResponse = await fetch(`https://api.github.com/users/${owner}`);
                        
                        if (avatarResponse.ok) {
                            const userData = await avatarResponse.json();
                            localStorage.setItem(avatarCacheKey, userData.avatar_url);
                            localStorage.setItem(
                                `${avatarCacheKey}-timestamp`,
                                Date.now().toString()
                            );
                            setAvatarUrl(userData.avatar_url);
                        } else if (avatarResponse.status === 404) {
                            // User not found - use first letter avatar
                            setAvatarUrl(null);
                        }
                    } catch (avatarError) {
                        console.warn('Could not fetch avatar:', avatarError);
                        // Keep using cached avatar if available
                        if (cachedAvatar) setAvatarUrl(cachedAvatar);
                    }
                }
                
                // Try to fetch repo stats if needed
                if (!isStatsValid) {
                    try {
                        const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
                        
                        if (repoResponse.ok) {
                            const repoData = await repoResponse.json();
                            const stats = {
                                stars: repoData.stargazers_count,
                                forks: repoData.forks_count,
                                issues: repoData.open_issues_count
                            };
                            localStorage.setItem(statsCacheKey, JSON.stringify(stats));
                            localStorage.setItem(
                                `${statsCacheKey}-timestamp`,
                                Date.now().toString()
                            );
                            setRepoStats(stats);
                        } else if (repoResponse.status === 404 || repoResponse.status === 403) {
                            // Repository not found or private - set empty stats
                            const privateRepoStats = {
                                stars: '-',
                                forks: '-',
                                issues: '-',
                                isPrivate: true
                            };
                            setRepoStats(privateRepoStats);
                            localStorage.setItem(statsCacheKey, JSON.stringify(privateRepoStats));
                            localStorage.setItem(
                                `${statsCacheKey}-timestamp`,
                                Date.now().toString()
                            );
                        }
                    } catch (statsError) {
                        console.warn('Could not fetch repo stats:', statsError);
                        // Use cached stats or create private repo placeholder
                        if (cachedStats) {
                            setRepoStats(JSON.parse(cachedStats));
                        } else {
                            const privateRepoStats = {
                                stars: '-',
                                forks: '-',
                                issues: '-',
                                isPrivate: true
                            };
                            setRepoStats(privateRepoStats);
                        }
                    }
                }
            } catch (error) {
                console.error('Error in fetchAvatarAndStats:', error);
                // Use cached values if available
                if (cachedAvatar && !isAvatarValid) setAvatarUrl(cachedAvatar);
                if (cachedStats && !isStatsValid) {
                    setRepoStats(JSON.parse(cachedStats));
                } else {
                    // Provide default stats for private repos
                    setRepoStats({
                        stars: '-',
                        forks: '-',
                        issues: '-',
                        isPrivate: true
                    });
                }
            }
        };

        fetchAvatarAndStats();
    }, [settings?.gitRepo]);

    const handleLinkRepo = () => {
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
                setShowUnlinkModal(false);
            } else {
                // Check if the error is a structured object
                if (
                    typeof response.error === 'object' &&
                    response.error.error
                ) {
                    Alert.error(response.error.error);
                } else if (typeof response.error === 'string') {
                    Alert.error(response.error);
                } else {
                    Alert.error('Failed to unlink repository');
                }
            }
        } catch (error) {
            if (error.response?.data?.error) {
                Alert.error(error.response.data.error);
            } else {
                Alert.error(
                    'An unexpected error occurred while unlinking the repository'
                );
            }
            console.error('Error unlinking repository:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const handleLinkSubmit = async () => {
        try {
            const fetchedSettings = await getSettings();
            setSettings(fetchedSettings);
            if (fetchedSettings) {
                await fetchGitStatus();
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            Alert.error('Failed to update repository settings');
        } finally {
            setLoadingAction('');
            setShowLinkModal(false);
        }
    };

    const repoFullName = settings ? getRepoFullName(settings.gitRepo) : '';
    const avatarColor = settings ? getAvatarColor(repoFullName) : '';
    const firstLetter = settings ? getFirstLetter() : '';

    return (
        <div className='space-y-4 mb-6'>
            <div className='bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden'>
                <div className='p-6'>
                    {!settings ? (
                        <EmptyRepo
                            onLinkRepo={handleLinkRepo}
                            loadingAction={loadingAction}
                        />
                    ) : (
                        <ActiveRepo
                            settings={settings}
                            status={status}
                            avatarUrl={avatarUrl}
                            repoStats={repoStats}
                            repoFullName={repoFullName}
                            avatarColor={avatarColor}
                            firstLetter={firstLetter}
                            onUnlinkRepo={() => setShowUnlinkModal(true)}
                            onShowBranches={() => setShowBranchModal(true)}
                            onShowCommits={() => setShowCommitModal(true)}
                            loadingAction={loadingAction}
                        />
                    )}
                </div>
            </div>

            <LinkRepo
                isOpen={showLinkModal}
                onClose={() => {
                    setShowLinkModal(false);
                    setLoadingAction('');
                }}
                onSubmit={handleLinkSubmit}
            />
            <UnlinkRepo
                isOpen={showUnlinkModal}
                onClose={() => setShowUnlinkModal(false)}
                onSubmit={handleUnlinkRepo}
            />
            {settings && status && (
                <>
                    <ViewBranches
                        isOpen={showBranchModal}
                        onClose={() => setShowBranchModal(false)}
                        repoUrl={settings.gitRepo}
                        currentBranch={status.branch}
                        onBranchChange={fetchGitStatus}
                    />
                    <ViewCommits
                        isOpen={showCommitModal}
                        onClose={() => setShowCommitModal(false)}
                        repoUrl={settings.gitRepo}
                        currentBranch={status.branch}
                        localCommits={status.local_commits || []}
                        remoteCommits={status.remote_commits || []}
                        outgoingChanges={status.outgoing_changes || []}
                        incomingChanges={status.incoming_changes || []}
                    />
                </>
            )}
        </div>
    );
};

export default RepoContainer;
