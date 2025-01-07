import React, {useState, useEffect} from 'react';
import {GitMerge} from 'lucide-react';
import Alert from '@ui/Alert';
import Modal from '@ui/Modal';
import {getRandomMessage, noChangesMessages} from '@constants/messages';
import {abortMerge, finalizeMerge} from '@api/api';
import IncomingChanges from './IncomingChanges';
import OutgoingChanges from './OutgoingChanges';
import MergeConflicts from './MergeConflicts';
import CommitSection from './CommitMessage';
import AutoPullToggle from './AutoPullToggle';

const StatusContainer = ({
    status,
    settings,
    onStageSelected,
    onUnstageSelected,
    onCommitSelected,
    onRevertSelected,
    onPullSelected,
    onPushSelected,
    loadingAction,
    fetchGitStatus
}) => {
    const [sortConfig, setSortConfig] = useState({
        key: 'type',
        direction: 'ascending'
    });
    const [selectedOutgoingChanges, setSelectedOutgoingChanges] = useState([]);
    const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
    const [willBeSelected, setWillBeSelected] = useState([]);
    const [commitMessage, setCommitMessage] = useState('');
    const [selectionType, setSelectionType] = useState(null);
    const [noChangesMessage, setNoChangesMessage] = useState('');
    const [isAbortModalOpen, setIsAbortModalOpen] = useState(false);

    // Status flags
    const hasIncomingChanges = status.incoming_changes.length > 0;
    const hasMergeConflicts = status.merge_conflicts.length > 0;
    const hasUncommittedChanges =
        status.outgoing_changes.filter(change => !change.committed).length > 0;
    const hasUnpushedCommits =
        settings?.has_profilarr_pat === 'true' && status.has_unpushed_commits;
    const hasChanges =
        hasIncomingChanges ||
        hasMergeConflicts ||
        hasUncommittedChanges ||
        hasUnpushedCommits;

    // Enable/disable flags
    const canCommit =
        selectedOutgoingChanges.length > 0 &&
        selectionType === 'staged' &&
        commitMessage.trim().length > 0;

    const getButtonTooltips = {
        stage: () => {
            if (selectionType === 'staged')
                return 'These files are already staged';
            if (selectedOutgoingChanges.length === 0)
                return 'Select files to stage';
            return 'Stage Changes';
        },
        unstage: () => {
            if (selectionType === 'unstaged')
                return 'These files are not staged';
            if (selectedOutgoingChanges.length === 0)
                return 'Select files to unstage';
            return 'Unstage Changes';
        },
        commit: () => {
            if (selectionType !== 'staged')
                return 'You can only commit staged files';
            if (selectedOutgoingChanges.length === 0)
                return 'Select files to commit';
            if (!commitMessage.trim()) return 'Enter a commit message';
            return 'Commit Changes';
        },
        revert: () => {
            if (selectedOutgoingChanges.length === 0)
                return 'Select files to revert';
            return 'Revert Changes';
        }
    };

    const handleSelectChange = (filePath, index, isShiftKey) => {
        const change = status.outgoing_changes.find(
            c => c.file_path === filePath
        );
        if (!change) {
            console.error('Could not find change for file path:', filePath);
            return;
        }

        const isStaged = change.staged;

        if (isShiftKey && lastSelectedIndex !== null) {
            // Handle shift-click selection
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);

            const selectableChanges = status.outgoing_changes
                .slice(start, end + 1)
                .filter(c => c.staged === isStaged)
                .map(c => c.file_path);

            setSelectedOutgoingChanges(prev => {
                const newSelection = [
                    ...new Set([...prev, ...selectableChanges])
                ];
                if (newSelection.length === 0) {
                    setSelectionType(null);
                } else {
                    setSelectionType(isStaged ? 'staged' : 'unstaged');
                }
                return newSelection;
            });
        } else {
            // Single selection handling
            setSelectedOutgoingChanges(prevSelected => {
                if (prevSelected.includes(filePath)) {
                    const newSelection = prevSelected.filter(
                        path => path !== filePath
                    );
                    if (newSelection.length === 0) {
                        setSelectionType(null);
                    }
                    return newSelection;
                } else {
                    if (prevSelected.length === 0) {
                        setSelectionType(isStaged ? 'staged' : 'unstaged');
                        setLastSelectedIndex(index);
                        return [filePath];
                    } else if (
                        (isStaged && selectionType === 'staged') ||
                        (!isStaged && selectionType === 'unstaged')
                    ) {
                        setLastSelectedIndex(index);
                        return [...prevSelected, filePath];
                    }
                    return prevSelected;
                }
            });
        }
    };

    const handleMouseEnter = (filePath, index, isShiftKey) => {
        if (isShiftKey && lastSelectedIndex !== null) {
            const change = status.outgoing_changes.find(
                c => c.file_path === filePath
            );
            if (!change) return;

            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);

            const potentialSelection = status.outgoing_changes
                .slice(start, end + 1)
                .filter(c => c.staged === change.staged)
                .map(c => c.file_path);

            setWillBeSelected(potentialSelection);
        }
    };

    const handleMouseLeave = () => {
        setWillBeSelected([]);
    };

    const handleCommitSelected = (files, message) => {
        if (!message.trim()) {
            console.error('Commit message cannot be empty');
            return;
        }
        onCommitSelected(files, message);
    };

    const areAllConflictsResolved = () => {
        return status.merge_conflicts.every(
            conflict => conflict.status === 'RESOLVED'
        );
    };

    const handleMergeCommit = async () => {
        try {
            const response = await finalizeMerge();
            if (response.success) {
                await fetchGitStatus();
                Alert.success(response.message);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            console.error('Error finalizing merge:', error);
            Alert.error(
                'An unexpected error occurred while finalizing the merge.'
            );
        }
    };

    const handleAbortMerge = async () => {
        try {
            const response = await abortMerge();
            if (response.success) {
                await fetchGitStatus();
                Alert.success(response.message);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            console.error('Error aborting merge:', error);
            Alert.error(
                'An unexpected error occurred while aborting the merge.'
            );
        } finally {
            setIsAbortModalOpen(false);
        }
    };

    // Add keyboard event listeners for shift key
    useEffect(() => {
        const handleKeyDown = e => {
            if (e.key === 'Shift' && lastSelectedIndex !== null) {
                // Find the element under the mouse cursor
                const element = document.elementFromPoint(
                    window.mouseX,
                    window.mouseY
                );
                if (element) {
                    // Find the closest tr element
                    const row = element.closest('tr');
                    if (row) {
                        const index = Array.from(
                            row.parentNode.children
                        ).indexOf(row);
                        const change = status.outgoing_changes[index];
                        if (change) {
                            handleMouseEnter(change.file_path, index, true);
                        }
                    }
                }
            }
        };

        const handleKeyUp = () => {
            setWillBeSelected([]);
        };

        // Track mouse position
        const handleMouseMove = e => {
            window.mouseX = e.clientX;
            window.mouseY = e.clientY;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [lastSelectedIndex, status.outgoing_changes]);

    useEffect(() => {
        if (!hasChanges) {
            setNoChangesMessage(getRandomMessage(noChangesMessages));
        }
    }, [hasChanges]);

    useEffect(() => {
        if (selectionType !== 'staged') {
            setCommitMessage('');
        }
    }, [selectionType]);

    return (
        <div className='bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden'>
            <div className='p-6 space-y-4'>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center justify-between w-full'>
                        <div className='flex items-center'>
                            <GitMerge
                                className='mr-2 text-green-400'
                                size={14}
                            />
                            <h3 className='text-m font-semibold text-gray-100 mr-2'>
                                Sync Status:
                            </h3>
                            {!hasChanges ? (
                                <span className='text-m font-medium text-gray-300'>
                                    {noChangesMessage}
                                </span>
                            ) : (
                                <span className='text-white-400 text-m flex items-center space-x-2'>
                                    <span>Out of Date!</span>
                                </span>
                            )}
                        </div>
                        <AutoPullToggle />
                    </div>
                </div>

                {status.is_merging ? (
                    <MergeConflicts
                        conflicts={status.merge_conflicts}
                        onMergeCommit={handleMergeCommit}
                        onAbortMerge={() => setIsAbortModalOpen(true)}
                        areAllConflictsResolved={areAllConflictsResolved}
                        fetchGitStatus={fetchGitStatus}
                    />
                ) : (
                    <>
                        <IncomingChanges
                            changes={status.incoming_changes}
                            onPullSelected={onPullSelected}
                            loadingAction={loadingAction}
                            sortConfig={sortConfig}
                            onRequestSort={key =>
                                setSortConfig(prev => ({
                                    key,
                                    direction:
                                        prev.key === key &&
                                        prev.direction === 'ascending'
                                            ? 'descending'
                                            : 'ascending'
                                }))
                            }
                        />

                        <OutgoingChanges
                            changes={status.outgoing_changes.filter(
                                change => !change.committed
                            )}
                            unpushedFiles={status.unpushed_files}
                            hasUnpushedCommits={hasUnpushedCommits}
                            selectedChanges={selectedOutgoingChanges}
                            willBeSelected={willBeSelected}
                            onSelectChange={handleSelectChange}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            onStageSelected={onStageSelected}
                            onUnstageSelected={onUnstageSelected}
                            onCommitSelected={handleCommitSelected}
                            onPushSelected={onPushSelected}
                            onRevertSelected={onRevertSelected}
                            loadingAction={loadingAction}
                            sortConfig={sortConfig}
                            onRequestSort={key =>
                                setSortConfig(prev => ({
                                    key,
                                    direction:
                                        prev.key === key &&
                                        prev.direction === 'ascending'
                                            ? 'descending'
                                            : 'ascending'
                                }))
                            }
                            selectionType={selectionType}
                            commitMessage={commitMessage}
                            canCommit={canCommit}
                            getButtonTooltips={getButtonTooltips}
                        />
                    </>
                )}

                {selectionType === 'staged' &&
                    selectedOutgoingChanges.length > 0 && (
                        <CommitSection
                            status={status}
                            commitMessage={commitMessage}
                            setCommitMessage={setCommitMessage}
                            selectedOutgoingChanges={selectedOutgoingChanges}
                            loadingAction={loadingAction}
                            hasIncomingChanges={hasIncomingChanges}
                            hasMergeConflicts={hasMergeConflicts}
                        />
                    )}

                <Modal
                    isOpen={isAbortModalOpen}
                    onClose={() => setIsAbortModalOpen(false)}
                    title='Confirm Abort Merge'
                    width='md'>
                    <div className='space-y-4'>
                        <div className='text-gray-300'>
                            <p>
                                Are you sure you want to abort the current
                                merge?
                            </p>
                            <p className='mt-2 text-yellow-400'>
                                This will discard all merge progress and restore
                                your repository to its state before the merge
                                began.
                            </p>
                        </div>
                        <div className='flex justify-end space-x-3'>
                            <button
                                onClick={handleAbortMerge}
                                className='px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'>
                                Abort Merge
                            </button>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
};

export default StatusContainer;
