import React, {useState, useEffect} from 'react';
import {
    Loader,
    Unlink,
    Link,
    Eye,
    GitBranch,
    GitCommit,
    Star,
    CircleDot,
    GitFork,
    Info
} from 'lucide-react';
import GithubIcon from '@logo/GitHub.svg';
import Tooltip from '@ui/Tooltip';
import {unlinkRepo, getSettings} from '@api/api';
import Alert from '@ui/Alert';
import LinkRepo from '../repo/LinkRepo';
import UnlinkRepo from '../repo/UnlinkRepo';
import ViewBranches from '../repo/ViewBranches';
import ViewCommits from '../repo/ViewCommits';

const RepoContainer = ({settings, setSettings, fetchGitStatus, status}) => {
    const [loadingAction, setLoadingAction] = useState('');
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showUnlinkRepo, setShowUnlinkRepo] = useState(false);
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [showCommitModal, setShowCommitModal] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [repoStats, setRepoStats] = useState(null);

    const getRepoFullName = url => {
        if (!url) return '';
        const parts = url.split('/');
        const repo = parts[parts.length - 1].replace('.git', '');
        const org = parts[parts.length - 2];

        // Special case for Dictionarry-Hub
        if (org === 'Dictionarry-Hub') {
            return 'Dictionarry / Database';
        }
        return `${org}/${repo}`;
    };

    const getFirstLetter = url => {
        if (!url) return '';
        const parts = url.split('/');
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
            const statsCacheKey = `github-stats-${repoFullName}`;

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
                Date.now() - parseInt(statsTimestamp) < 1 * 60 * 60 * 1000; // 1 hour for stats

            if (cachedAvatar && isAvatarValid) {
                setAvatarUrl(cachedAvatar);
            }

            if (cachedStats && isStatsValid) {
                setRepoStats(JSON.parse(cachedStats));
            }

            try {
                const [avatarResponse, repoResponse] = await Promise.all([
                    !isAvatarValid &&
                        fetch(`https://api.github.com/users/${owner}`),
                    !isStatsValid &&
                        fetch(`https://api.github.com/repos/${owner}/${repo}`)
                ]);

                if (!isAvatarValid && avatarResponse.ok) {
                    const userData = await avatarResponse.json();
                    localStorage.setItem(avatarCacheKey, userData.avatar_url);
                    localStorage.setItem(
                        `${avatarCacheKey}-timestamp`,
                        Date.now().toString()
                    );
                    setAvatarUrl(userData.avatar_url);
                }

                if (!isStatsValid && repoResponse.ok) {
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
                }
            } catch (error) {
                console.error('Error fetching GitHub data:', error);
                // Use cached data if available, regardless of age
                if (cachedAvatar && !isAvatarValid) setAvatarUrl(cachedAvatar);
                if (cachedStats && !isStatsValid)
                    setRepoStats(JSON.parse(cachedStats));
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

    return (
        <div className='space-y-4 mb-6'>
            <div className='bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden'>
                <div className='p-6'>
                    <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0'>
                        <div className='flex items-center space-x-4'>
                            {!settings ? (
                                <div className='flex items-center space-x-4'>
                                    <img
                                        src={GithubIcon}
                                        alt='GitHub'
                                        className='w-8 h-8 filter invert'
                                    />
                                    <div>
                                        <h2 className='text-lg font-medium text-white'>
                                            No Repository Connected
                                        </h2>
                                        <p className='text-sm text-gray-400'>
                                            Profilarr leverages Git to create an
                                            open-source configuration sharing
                                            system. Connect to the{' '}
                                            <a
                                                href='https://github.com/Dictionarry-Hub/database'
                                                className='text-blue-500 hover:underline'
                                                target='_blank'
                                                rel='noopener noreferrer'>
                                                Dictionarry Database
                                            </a>{' '}
                                            or any external database to get
                                            started.
                                        </p>
                                    </div>
                                </div>
                            ) : avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt={`${repoFullName} avatar`}
                                    className='w-10 h-10 rounded-lg shadow-lg'
                                    onError={e => {
                                        e.target.style.display = 'none';
                                        e.target.nextElementSibling.style.display =
                                            'flex';
                                    }}
                                />
                            ) : (
                                <div
                                    className={`w-10 h-10 ${getAvatarColor(
                                        repoFullName
                                    )} rounded-lg flex items-center justify-center text-white text-lg font-bold shadow-lg`}>
                                    {getFirstLetter(settings.gitRepo)}
                                </div>
                            )}
                            {settings && (
                                <div>
                                    <a
                                        href={settings.gitRepo}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-lg font-bold text-white hover:text-blue-400 transition-colors'>
                                        {repoFullName}
                                    </a>
                                    <div className='flex items-center space-x-3 mt-1 text-gray-400'>
                                        {repoStats ? (
                                            <>
                                                <div className='flex items-center space-x-1'>
                                                    <Star
                                                        size={14}
                                                        className='text-gray-400'
                                                    />
                                                    <span className='text-xs'>
                                                        {repoStats.stars}
                                                    </span>
                                                </div>
                                                <div className='flex items-center space-x-1'>
                                                    <CircleDot
                                                        size={14}
                                                        className='text-gray-400'
                                                    />
                                                    <span className='text-xs'>
                                                        {repoStats.issues}
                                                    </span>
                                                </div>
                                                <div className='flex items-center space-x-1'>
                                                    <GitFork
                                                        size={14}
                                                        className='text-gray-400'
                                                    />
                                                    <span className='text-xs'>
                                                        {repoStats.forks}
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <Loader
                                                size={14}
                                                className='animate-spin'
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className='flex items-center space-x-3'>
                            {settings && (
                                <>
                                    <button
                                        onClick={() => setShowBranchModal(true)}
                                        className='flex items-center space-x-2 bg-gray-700/50 px-3 py-2 rounded-lg hover:bg-gray-600/50 transition-colors duration-200'
                                        disabled={!status}>
                                        <GitBranch
                                            className='text-blue-400'
                                            size={16}
                                        />
                                        <span className='text-sm font-medium text-gray-200'>
                                            {status
                                                ? status.branch
                                                : 'Loading...'}
                                        </span>
                                    </button>
                                    {status && status.local_commits && (
                                        <div className='bg-gray-700/50 px-3 py-2 rounded-lg'>
                                            <span className='text-sm text-gray-200'>
                                                <span className='font-medium'>
                                                    {
                                                        status.local_commits
                                                            .length
                                                    }
                                                </span>{' '}
                                                local commits
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setShowCommitModal(true)}
                                        className='flex items-center px-3 py-2 bg-gray-700/50 text-white rounded-lg hover:bg-gray-600/50 transition-colors duration-200 ease-in-out text-sm font-medium'
                                        disabled={!status}>
                                        <GitCommit size={16} className='mr-2' />
                                        Commits
                                    </button>
                                </>
                            )}
                            <Tooltip
                                content={
                                    settings
                                        ? 'Unlink Repository'
                                        : 'Link Repository'
                                }>
                                <button
                                    onClick={
                                        settings
                                            ? () => setShowUnlinkRepo(true)
                                            : handleLinkRepo
                                    }
                                    className={`flex items-center px-4 py-2 ${
                                        settings
                                            ? 'bg-gray-700/50 hover:bg-gray-600/50'
                                            : 'bg-blue-500 hover:bg-blue-600'
                                    } text-white rounded-lg transition-all duration-200 ease-in-out text-sm font-medium ${
                                        loadingAction
                                            ? 'opacity-50 cursor-not-allowed'
                                            : ''
                                    }`}
                                    disabled={loadingAction !== ''}>
                                    {loadingAction ? (
                                        <Loader
                                            size={16}
                                            className='animate-spin mr-2'
                                        />
                                    ) : settings ? (
                                        <Unlink size={16} className='mr-2' />
                                    ) : (
                                        <Link size={16} className='mr-2' />
                                    )}
                                    {settings ? 'Unlink' : 'Link Repository'}
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            </div>

            <LinkRepo
                isOpen={showLinkModal}
                onClose={() => {
                    setShowLinkModal(false);
                    setLoadingAction('');
                }}
                onSubmit={onLinkSubmit}
            />
            <UnlinkRepo
                isOpen={showUnlinkRepo}
                onClose={() => setShowUnlinkRepo(false)}
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
