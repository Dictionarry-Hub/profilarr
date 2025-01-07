import React from 'react';
import {
    Loader,
    Unlink,
    GitBranch,
    GitCommit,
    Star,
    CircleDot,
    GitFork
} from 'lucide-react';
import Tooltip from '@ui/Tooltip';

const RepoAvatar = ({avatarUrl, repoFullName, avatarColor, firstLetter}) => {
    if (avatarUrl) {
        return (
            <img
                src={avatarUrl}
                alt={`${repoFullName} avatar`}
                className='w-10 h-10 rounded-lg shadow-lg'
                onError={e => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                }}
            />
        );
    }

    return (
        <div
            className={`w-10 h-10 ${avatarColor} rounded-lg flex items-center justify-center text-white text-lg font-bold shadow-lg`}>
            {firstLetter}
        </div>
    );
};

const RepoStats = ({repoStats}) => {
    if (!repoStats) {
        return <Loader size={14} className='animate-spin' />;
    }

    return (
        <>
            <div className='flex items-center space-x-1'>
                <Star size={14} className='text-gray-400' />
                <span className='text-xs'>{repoStats.stars}</span>
            </div>
            <div className='flex items-center space-x-1'>
                <CircleDot size={14} className='text-gray-400' />
                <span className='text-xs'>{repoStats.issues}</span>
            </div>
            <div className='flex items-center space-x-1'>
                <GitFork size={14} className='text-gray-400' />
                <span className='text-xs'>{repoStats.forks}</span>
            </div>
        </>
    );
};

const ActiveRepo = ({
    settings,
    status,
    avatarUrl,
    repoStats,
    repoFullName,
    avatarColor,
    firstLetter,
    onUnlinkRepo,
    loadingAction,
    onShowBranches,
    onShowCommits
}) => {
    return (
        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0'>
            <div className='flex items-center space-x-4'>
                <RepoAvatar
                    avatarUrl={avatarUrl}
                    repoFullName={repoFullName}
                    avatarColor={avatarColor}
                    firstLetter={firstLetter}
                />
                <div>
                    <a
                        href={settings.gitRepo}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-lg font-bold text-white hover:text-blue-400 transition-colors'>
                        {repoFullName}
                    </a>
                    <div className='flex items-center space-x-3 mt-1 text-gray-400'>
                        <RepoStats repoStats={repoStats} />
                    </div>
                </div>
            </div>
            <div className='flex items-center space-x-3'>
                <button
                    onClick={onShowBranches}
                    className='flex items-center space-x-2 bg-gray-700/50 px-3 py-2 rounded-lg hover:bg-gray-600/50 transition-colors duration-200'
                    disabled={!status}>
                    <GitBranch className='text-blue-400' size={16} />
                    <span className='text-sm font-medium text-gray-200'>
                        {status ? status.branch : 'Loading...'}
                    </span>
                </button>
                {status && status.local_commits && (
                    <div className='bg-gray-700/50 px-3 py-2 rounded-lg'>
                        <span className='text-sm text-gray-200'>
                            <span className='font-medium'>
                                {status.local_commits.length}
                            </span>{' '}
                            local commits
                        </span>
                    </div>
                )}
                <button
                    onClick={onShowCommits}
                    className='flex items-center px-3 py-2 bg-gray-700/50 text-white rounded-lg hover:bg-gray-600/50 transition-colors duration-200 ease-in-out text-sm font-medium'
                    disabled={!status}>
                    <GitCommit size={16} className='mr-2' />
                    Commits
                </button>
                <Tooltip content='Unlink Repository'>
                    <button
                        onClick={onUnlinkRepo}
                        className='flex items-center px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-lg transition-all duration-200 ease-in-out text-sm font-medium'
                        disabled={loadingAction !== ''}>
                        {loadingAction === 'unlink_repo' ? (
                            <Loader size={16} className='animate-spin mr-2' />
                        ) : (
                            <Unlink size={16} className='mr-2' />
                        )}
                        Unlink
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};

export default ActiveRepo;
