import React, {useState, useEffect} from 'react';
import {
    GitBranch,
    GitCommit,
    ExternalLink,
    ArrowUpRight,
    ArrowDownRight,
    GitMerge,
    Loader,
    User,
    Clock,
    Hash
} from 'lucide-react';
import Modal from '../../../ui/Modal';
import {getCommitHistory} from '../../../../api/api';
import Alert from '../../../ui/Alert';

const ViewCommits = ({isOpen, onClose, repoUrl, currentBranch}) => {
    const [selectedCommit, setSelectedCommit] = useState(null);
    const [loading, setLoading] = useState(true);
    const [commits, setCommits] = useState([]);
    const [aheadCount, setAheadCount] = useState(0);
    const [behindCount, setBehindCount] = useState(0);

    useEffect(() => {
        if (isOpen) {
            fetchCommitHistory();
        }
    }, [isOpen, currentBranch]);

    const fetchCommitHistory = async () => {
        setLoading(true);
        try {
            const response = await getCommitHistory(currentBranch);
            if (response.success) {
                setCommits(response.data.local_commits);
                setAheadCount(response.data.ahead_count);
                setBehindCount(response.data.behind_count);
            } else {
                Alert.error(response.error || 'Failed to fetch commit history');
            }
        } catch (error) {
            Alert.error('Failed to fetch commit history');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = dateStr => {
        const date = new Date(dateStr);
        return {
            date: date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }),
            time: date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            })
        };
    };

    const getCommitStatus = commit => {
        if (commit.isMerge) {
            return {
                icon: <GitMerge size={14} className='text-purple-500' />,
                text: 'Merge'
            };
        }

        const isAheadCommit =
            aheadCount > 0 && commits.indexOf(commit) < aheadCount;
        if (isAheadCommit) {
            return {
                icon: <ArrowUpRight size={14} className='text-green-500' />,
                text: 'Outgoing'
            };
        }

        return {
            icon: <GitCommit size={14} className='text-gray-400' />,
            text: 'Synced'
        };
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className='flex items-center justify-center h-40'>
                    <Loader className='w-6 h-6 animate-spin text-blue-500' />
                </div>
            );
        }

        if (commits.length === 0) {
            return (
                <div className='flex flex-col items-center justify-center h-40 text-gray-400'>
                    <GitCommit size={24} className='mb-2' />
                    <p className='text-sm'>No commits found in this branch</p>
                </div>
            );
        }

        return (
            <div className='space-y-2'>
                {commits.map(commit => {
                    const status = getCommitStatus(commit);
                    const formattedDate = formatDate(commit.date);
                    const isExpanded = selectedCommit === commit.hash;

                    return (
                        <div
                            key={commit.hash}
                            className={`p-3 rounded-lg border ${
                                isExpanded
                                    ? 'border-blue-500 dark:bg-gray-700'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
                            } transition-colors cursor-pointer`}
                            onClick={() => setSelectedCommit(commit.hash)}>
                            <div>
                                {/* Top section: Message and Hash */}
                                <div
                                    className={`flex justify-between items-center ${
                                        isExpanded ? 'mb-3' : ''
                                    }`}>
                                    <div className='flex items-center space-x-3 flex-1'>
                                        {status.icon}
                                        <span className='text-xs font-medium font-mono truncate'>
                                            {commit.message}
                                        </span>
                                    </div>
                                    <div className='flex items-center space-x-1.5 text-xs text-gray-400 ml-4'>
                                        <Hash
                                            size={12}
                                            className='text-gray-500'
                                        />
                                        <span className='font-mono'>
                                            {commit.hash.substring(0, 7)}
                                        </span>
                                    </div>
                                </div>

                                {/* Details section */}
                                {isExpanded && (
                                    <>
                                        <div className='w-full border-t border-gray-700 mb-3'></div>
                                        <div className='mb-3 text-sm text-gray-400 py-3'>
                                            <div className='grid grid-cols-2 gap-4 text-xs'>
                                                <div>
                                                    <div className='font-semibold mb-1'>
                                                        Files Changed (
                                                        {
                                                            commit.details
                                                                .files_changed
                                                                .length
                                                        }
                                                        ):
                                                    </div>
                                                    <ul className='list-disc list-inside'>
                                                        {commit.details.files_changed.map(
                                                            (file, idx) => (
                                                                <li
                                                                    key={idx}
                                                                    className='truncate font-mono'>
                                                                    {file}
                                                                </li>
                                                            )
                                                        )}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <div className='font-semibold mb-1'>
                                                        Changes:
                                                    </div>
                                                    {commit.details.insertions >
                                                        0 && (
                                                        <div className='text-green-400'>
                                                            +
                                                            {
                                                                commit.details
                                                                    .insertions
                                                            }{' '}
                                                            lines added
                                                        </div>
                                                    )}
                                                    {commit.details.deletions >
                                                        0 && (
                                                        <div className='text-red-400'>
                                                            -
                                                            {
                                                                commit.details
                                                                    .deletions
                                                            }{' '}
                                                            lines removed
                                                        </div>
                                                    )}
                                                    {commit.details
                                                        .insertions === 0 &&
                                                        commit.details
                                                            .deletions ===
                                                            0 && (
                                                            <div className='text-gray-400'>
                                                                No line changes
                                                                detected
                                                            </div>
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className='w-full border-t border-gray-700 mb-3'></div>
                                    </>
                                )}

                                {/* Bottom section: Author and date */}
                                <div className='flex justify-between items-center text-xs text-gray-400'>
                                    <div className='flex items-center space-x-1.5'>
                                        <User
                                            size={12}
                                            className='text-gray-500'
                                        />
                                        <span className='truncate'>
                                            {commit.author}
                                        </span>
                                    </div>
                                    <div className='flex items-center space-x-1.5'>
                                        <Clock
                                            size={12}
                                            className='text-gray-500'
                                        />
                                        <span>
                                            {formattedDate.date} at{' '}
                                            {formattedDate.time}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className='flex items-center justify-between w-full'>
                    <div className='flex items-center space-x-2'>
                        <GitBranch size={16} className='text-blue-400' />
                        <span className='text-base'>
                            Commit History - {currentBranch}
                        </span>
                    </div>
                    {(aheadCount > 0 || behindCount > 0) && (
                        <div className='flex items-center space-x-3 text-sm px-2'>
                            {aheadCount > 0 && (
                                <div className='flex items-center text-green-400 bg-green-400/10 px-2 py-1 rounded'>
                                    <ArrowUpRight size={14} className='mr-1' />
                                    <span>
                                        {aheadCount} commit
                                        {aheadCount !== 1 ? 's' : ''} ahead
                                    </span>
                                </div>
                            )}
                            {behindCount > 0 && (
                                <div className='flex items-center text-blue-400 bg-blue-400/10 px-2 py-1 rounded'>
                                    <ArrowDownRight
                                        size={14}
                                        className='mr-1'
                                    />
                                    <span>
                                        {behindCount} commit
                                        {behindCount !== 1 ? 's' : ''} behind
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            }
            width='screen-xl'
            height='lg'>
            <div className='space-y-4'>
                <div className='overflow-y-auto max-h-[60vh]'>
                    {renderContent()}
                </div>
            </div>
        </Modal>
    );
};

export default ViewCommits;
