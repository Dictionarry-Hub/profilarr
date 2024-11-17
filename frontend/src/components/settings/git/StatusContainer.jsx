import React, {useState, useEffect} from 'react';
import {
    GitMerge,
    ArrowUpFromLine,
    ArrowDownToLine,
    AlertTriangle,
    Download,
    Plus,
    CheckCircle,
    RotateCcw,
    Upload,
    MinusCircle,
    XCircle
} from 'lucide-react';
import ChangeTable from './ChangeTable';
import ConflictTable from './ConflictTable';
import CommitSection from './CommitMessage';
import Modal from '../../ui/Modal';
import Tooltip from '../../ui/Tooltip';
import {getRandomMessage, noChangesMessages} from '../../../utils/messages';
import IconButton from '../../ui/IconButton';
import {abortMerge, finalizeMerge} from '../../../api/api';
import Alert from '../../ui/Alert';

const StatusContainer = ({
    status,
    isDevMode,
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
    const [selectedMergeConflicts, setSelectedMergeConflicts] = useState([]);
    const [commitMessage, setCommitMessage] = useState('');
    const [selectionType, setSelectionType] = useState(null);
    const [noChangesMessage, setNoChangesMessage] = useState('');
    const [isAbortModalOpen, setIsAbortModalOpen] = useState(false);

    const canStage =
        selectedOutgoingChanges.length > 0 && selectionType !== 'staged';

    const canCommit =
        selectedOutgoingChanges.length > 0 &&
        selectionType === 'staged' &&
        commitMessage.trim().length > 0;

    const canRevert = selectedOutgoingChanges.length > 0;
    const canPush = isDevMode && status.has_unpushed_commits;

    const requestSort = key => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({key, direction});
    };

    const handleSelectChange = filePath => {
        const change = status.outgoing_changes.find(
            c => c.file_path === filePath
        );

        if (!change) {
            console.error('Could not find change for file path:', filePath);
            return;
        }

        const isStaged = change.staged;

        console.log('Selection change:', {
            filePath,
            isStaged,
            currentSelectionType: selectionType,
            currentSelected: selectedOutgoingChanges
        });

        setSelectedOutgoingChanges(prevSelected => {
            if (prevSelected.includes(filePath)) {
                // Deselecting a file
                const newSelection = prevSelected.filter(
                    path => path !== filePath
                );
                // If no more files are selected, reset selection type
                if (newSelection.length === 0) {
                    setSelectionType(null);
                }
                return newSelection;
            } else {
                // Selecting a file
                if (prevSelected.length === 0) {
                    // First selection sets the type
                    setSelectionType(isStaged ? 'staged' : 'unstaged');
                    return [filePath];
                } else if (
                    (isStaged && selectionType === 'staged') ||
                    (!isStaged && selectionType === 'unstaged')
                ) {
                    // Only allow selection if it matches current type
                    return [...prevSelected, filePath];
                }
                // Don't add if it doesn't match the type
                return prevSelected;
            }
        });
    };

    const handleCommitSelected = (files, message) => {
        if (!message.trim()) {
            console.error('Commit message cannot be empty');
            return;
        }
        onCommitSelected(files, message);
    };

    const getStageButtonTooltip = () => {
        if (selectionType === 'staged') {
            return 'These files are already staged';
        }
        if (selectedOutgoingChanges.length === 0) {
            return 'Select files to stage';
        }
        return 'Stage Changes';
    };

    const getUnstageButtonTooltip = () => {
        if (selectionType === 'unstaged') {
            return 'These files are not staged';
        }
        if (selectedOutgoingChanges.length === 0) {
            return 'Select files to unstage';
        }
        return 'Unstage Changes';
    };

    const getCommitButtonTooltip = () => {
        if (selectionType !== 'staged') {
            return 'You can only commit staged files';
        }
        if (selectedOutgoingChanges.length === 0) {
            return 'Select files to commit';
        }
        if (!commitMessage.trim()) {
            return 'Enter a commit message';
        }
        return 'Commit Changes';
    };

    const getRevertButtonTooltip = () => {
        if (selectedOutgoingChanges.length === 0) {
            return 'Select files to revert';
        }
        return 'Revert Changes';
    };

    const handleAbortMergeClick = () => {
        setIsAbortModalOpen(true);
    };

    const handleConfirmAbortMerge = async () => {
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

    useEffect(() => {
        if (
            status.incoming_changes.length === 0 &&
            status.outgoing_changes.length === 0 &&
            status.merge_conflicts.length === 0 &&
            (!isDevMode || !status.has_unpushed_commits)
        ) {
            setNoChangesMessage(getRandomMessage(noChangesMessages));
        }
    }, [status, isDevMode]);

    // Reset commit message when selection changes
    useEffect(() => {
        if (selectionType !== 'staged') {
            setCommitMessage('');
        }
    }, [selectionType]);

    const hasChanges =
        status.incoming_changes.length > 0 ||
        status.outgoing_changes.length > 0 ||
        status.merge_conflicts.length > 0 ||
        (isDevMode && status.has_unpushed_commits);

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

    return (
        <div className='dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-md'>
            <div className='flex items-center justify-between'>
                <div className='flex items-center'>
                    <GitMerge className='mr-2 text-green-400' size={14} />
                    <h3 className='text-m font-semibold text-gray-100 mr-2'>
                        Sync Status:
                    </h3>
                    {!hasChanges ? (
                        <span className='text-m font-medium'>
                            {noChangesMessage}
                        </span>
                    ) : (
                        <span className='text-gray-400 text-m flex items-center space-x-2'>
                            <span>Out of Date!</span>
                        </span>
                    )}
                </div>
            </div>

            {status.is_merging ? (
                <div className='mb-4'>
                    <div className='flex items-center justify-between'>
                        <h4 className='text-sm font-medium text-gray-200 flex items-center'>
                            <AlertTriangle
                                className='text-yellow-400 mr-2'
                                size={16}
                            />
                            <span>Merge Conflicts</span>
                        </h4>
                        <div className='flex space-x-2'>
                            <Tooltip
                                content={
                                    areAllConflictsResolved()
                                        ? 'Commit merge changes'
                                        : 'Resolve all conflicts first'
                                }>
                                <button
                                    onClick={handleMergeCommit}
                                    disabled={!areAllConflictsResolved()}
                                    className={`p-1.5 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 
                                        ${
                                            areAllConflictsResolved()
                                                ? 'bg-green-500 hover:bg-green-600 focus:ring-green-500'
                                                : 'bg-gray-400 cursor-not-allowed'
                                        }`}>
                                    <CheckCircle size={16} />
                                </button>
                            </Tooltip>
                            <Tooltip content='Abort Merge'>
                                <button
                                    onClick={handleAbortMergeClick}
                                    className='p-1.5 text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'>
                                    <XCircle size={16} />
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                    <ConflictTable
                        conflicts={status.merge_conflicts}
                        isDevMode={isDevMode}
                        fetchGitStatus={fetchGitStatus}
                    />
                </div>
            ) : (
                <>
                    {status.incoming_changes.length > 0 && (
                        <div className='mb-4'>
                            <div className='flex items-center justify-between mb-2'>
                                <h4 className='text-sm font-medium text-gray-200 flex items-center'>
                                    <ArrowDownToLine
                                        className='text-blue-400 mr-2'
                                        size={16}
                                    />
                                    <span>
                                        Incoming Changes (
                                        {status.incoming_changes.length})
                                    </span>
                                </h4>
                                <IconButton
                                    onClick={onPullSelected}
                                    disabled={false}
                                    loading={loadingAction === 'pull_changes'}
                                    icon={<Download />}
                                    tooltip='Pull Changes'
                                    className='bg-yellow-600'
                                />
                            </div>
                            <div className='border border-gray-600 rounded-md overflow-hidden'>
                                <ChangeTable
                                    changes={status.incoming_changes}
                                    isIncoming={true}
                                    selectable={false}
                                    selectedChanges={[]}
                                    sortConfig={sortConfig}
                                    onRequestSort={requestSort}
                                    isDevMode={isDevMode}
                                />
                            </div>
                        </div>
                    )}

                    {(status.outgoing_changes.length > 0 ||
                        (isDevMode && status.has_unpushed_commits)) && (
                        <div className='mb-4'>
                            <div className='flex items-center justify-between mb-2'>
                                <h4 className='text-sm font-medium text-gray-200 flex items-center'>
                                    <ArrowUpFromLine
                                        className='text-blue-400 mr-2'
                                        size={16}
                                    />
                                    <span>
                                        Outgoing Changes (
                                        {status.outgoing_changes.length +
                                            (isDevMode && status.unpushed_files
                                                ? status.unpushed_files.length
                                                : 0)}
                                        )
                                    </span>
                                </h4>
                                <div className='space-x-2 flex'>
                                    <IconButton
                                        onClick={() =>
                                            onStageSelected(
                                                selectedOutgoingChanges
                                            )
                                        }
                                        disabled={
                                            selectionType !== 'unstaged' ||
                                            selectedOutgoingChanges.length === 0
                                        }
                                        loading={
                                            loadingAction === 'stage_selected'
                                        }
                                        icon={<Plus />}
                                        tooltip='Stage Changes'
                                        className='bg-green-600'
                                        disabledTooltip={getStageButtonTooltip()}
                                    />
                                    <IconButton
                                        onClick={() =>
                                            onUnstageSelected(
                                                selectedOutgoingChanges
                                            )
                                        }
                                        disabled={
                                            selectionType !== 'staged' ||
                                            selectedOutgoingChanges.length === 0
                                        }
                                        loading={
                                            loadingAction === 'unstage_selected'
                                        }
                                        icon={<MinusCircle />}
                                        tooltip='Unstage Changes'
                                        className='bg-yellow-600'
                                        disabledTooltip={getUnstageButtonTooltip()}
                                    />
                                    <IconButton
                                        onClick={() =>
                                            handleCommitSelected(
                                                selectedOutgoingChanges,
                                                commitMessage
                                            )
                                        }
                                        disabled={!canCommit}
                                        loading={
                                            loadingAction === 'commit_selected'
                                        }
                                        icon={<CheckCircle />}
                                        tooltip='Commit Changes'
                                        className='bg-blue-600'
                                        disabledTooltip={getCommitButtonTooltip()}
                                    />
                                    {isDevMode && (
                                        <IconButton
                                            onClick={onPushSelected}
                                            disabled={!canPush}
                                            loading={
                                                loadingAction === 'push_changes'
                                            }
                                            icon={<Upload />}
                                            tooltip={
                                                <div>
                                                    <div>Push Changes</div>
                                                    {status.unpushed_files
                                                        ?.length > 0 && (
                                                        <div className='mt-1 text-xs'>
                                                            {status.unpushed_files.map(
                                                                (
                                                                    file,
                                                                    index
                                                                ) => (
                                                                    <div
                                                                        key={
                                                                            index
                                                                        }>
                                                                        •{' '}
                                                                        {
                                                                            file.type
                                                                        }
                                                                        :{' '}
                                                                        {
                                                                            file.name
                                                                        }
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            }
                                            className='bg-purple-600'
                                            disabledTooltip='No changes to push'
                                        />
                                    )}
                                    <IconButton
                                        onClick={() =>
                                            onRevertSelected(
                                                selectedOutgoingChanges
                                            )
                                        }
                                        disabled={!canRevert}
                                        loading={
                                            loadingAction === 'revert_selected'
                                        }
                                        icon={<RotateCcw />}
                                        tooltip='Revert Changes'
                                        className='bg-red-600'
                                        disabledTooltip={getRevertButtonTooltip()}
                                    />
                                </div>
                            </div>
                            {status.outgoing_changes.length > 0 && (
                                <div className='border border-gray-600 rounded-md overflow-hidden'>
                                    <ChangeTable
                                        changes={status.outgoing_changes}
                                        isIncoming={false}
                                        selectedChanges={
                                            selectedOutgoingChanges
                                        }
                                        onSelectChange={filePath =>
                                            handleSelectChange(filePath)
                                        }
                                        sortConfig={sortConfig}
                                        onRequestSort={requestSort}
                                        isDevMode={isDevMode}
                                    />
                                </div>
                            )}
                        </div>
                    )}
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
                        hasIncomingChanges={status.incoming_changes.length > 0}
                        hasMergeConflicts={status.merge_conflicts.length > 0}
                        isDevMode={isDevMode}
                    />
                )}

            <Modal
                isOpen={isAbortModalOpen}
                onClose={() => setIsAbortModalOpen(false)}
                title='Confirm Abort Merge'
                width='md'>
                <div className='space-y-4'>
                    <div className='text-gray-700 dark:text-gray-300'>
                        <p>Are you sure you want to abort the current merge?</p>
                        <p className='mt-2 text-yellow-600 dark:text-yellow-400'>
                            This will discard all merge progress and restore
                            your repository to its state before the merge began.
                        </p>
                    </div>
                    <div className='flex justify-end space-x-3'>
                        <button
                            onClick={handleConfirmAbortMerge}
                            className='px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'>
                            Abort Merge
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default StatusContainer;
