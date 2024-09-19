import React, {useState, useEffect} from 'react';
import {GitBranch, GitMerge, Download} from 'lucide-react';
import ChangeTable from './ChangeTable';
import CommitSection from './CommitMessage';
import {getRandomMessage, noChangesMessages} from '../../../utils/messages';
import ActionButtons from './ActionButtons';

const StatusContainer = ({
    status,
    isDevMode,
    onStageSelected,
    onCommitSelected,
    onRevertSelected,
    onPullSelected,
    loadingAction
}) => {
    const [sortConfig, setSortConfig] = useState({
        key: 'type',
        direction: 'ascending'
    });
    const [selectedIncomingChanges, setSelectedIncomingChanges] = useState([]);
    const [selectedOutgoingChanges, setSelectedOutgoingChanges] = useState([]);
    const [commitMessage, setCommitMessage] = useState('');
    const [selectionType, setSelectionType] = useState(null);
    const [noChangesMessage, setNoChangesMessage] = useState('');

    const requestSort = key => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({key, direction});
    };

    const handleSelectChange = (filePath, isIncoming) => {
        if (isIncoming) {
            setSelectedIncomingChanges(prevSelected => {
                if (prevSelected.includes(filePath)) {
                    return prevSelected.filter(path => path !== filePath);
                } else {
                    return [...prevSelected, filePath];
                }
            });
        } else {
            const change = status.outgoing_changes.find(
                c => c.file_path === filePath
            );
            const isStaged = change.staged;

            setSelectedOutgoingChanges(prevSelected => {
                if (prevSelected.includes(filePath)) {
                    const newSelection = prevSelected.filter(
                        path => path !== filePath
                    );
                    if (newSelection.length === 0) setSelectionType(null);
                    return newSelection;
                } else {
                    if (
                        prevSelected.length === 0 ||
                        (isStaged && selectionType === 'staged') ||
                        (!isStaged && selectionType === 'unstaged')
                    ) {
                        setSelectionType(isStaged ? 'staged' : 'unstaged');
                        return [...prevSelected, filePath];
                    } else {
                        return prevSelected;
                    }
                }
            });
        }
    };

    const getStageButtonTooltip = () => {
        if (selectionType === 'staged') {
            return 'These files are already staged';
        }
        if (selectedOutgoingChanges.length === 0) {
            return 'Select files to stage';
        }
        return 'Stage selected files';
    };

    const getCommitButtonTooltip = () => {
        if (selectionType === 'unstaged') {
            return 'You can only commit staged files';
        }
        if (selectedOutgoingChanges.length === 0) {
            return 'Select files to commit';
        }
        if (!commitMessage.trim()) {
            return 'Enter a commit message';
        }
        return 'Commit selected files';
    };

    const getRevertButtonTooltip = () => {
        if (selectedOutgoingChanges.length === 0) {
            return 'Select files to revert';
        }
        return 'Revert selected files';
    };

    useEffect(() => {
        if (
            status.incoming_changes.length === 0 &&
            status.outgoing_changes.length === 0
        ) {
            setNoChangesMessage(getRandomMessage(noChangesMessages));
        }
    }, [status]);

    const hasChanges =
        status.incoming_changes.length > 0 ||
        status.outgoing_changes.length > 0;

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
                        <span className='text-gray-400 text-m flex items-center'>
                            Out of Date!
                        </span>
                    )}
                </div>
                {!hasChanges && (
                    <div className='flex-shrink-0'>
                        <ActionButtons
                            isDevMode={isDevMode}
                            selectedOutgoingChanges={selectedOutgoingChanges}
                            selectedIncomingChanges={selectedIncomingChanges}
                            selectionType={selectionType}
                            commitMessage={commitMessage}
                            loadingAction={loadingAction}
                            onStageSelected={onStageSelected}
                            onCommitSelected={onCommitSelected}
                            onRevertSelected={onRevertSelected}
                            onPullSelected={onPullSelected}
                            getStageButtonTooltip={getStageButtonTooltip}
                            getCommitButtonTooltip={getCommitButtonTooltip}
                            getRevertButtonTooltip={getRevertButtonTooltip}
                        />
                    </div>
                )}
            </div>

            {status.incoming_changes.length > 0 && (
                <ChangeTable
                    changes={status.incoming_changes}
                    title='Incoming Changes'
                    icon={
                        <Download className='text-yellow-400 mr-2' size={16} />
                    }
                    isIncoming={true}
                    selectedChanges={selectedIncomingChanges}
                    onSelectChange={handleSelectChange}
                    sortConfig={sortConfig}
                    onRequestSort={requestSort}
                    isDevMode={isDevMode}
                />
            )}

            {status.outgoing_changes.length > 0 && (
                <ChangeTable
                    changes={status.outgoing_changes}
                    title='Outgoing Changes'
                    icon={
                        <GitBranch className='text-blue-400 mr-2' size={16} />
                    }
                    isIncoming={false}
                    selectedChanges={selectedOutgoingChanges}
                    onSelectChange={handleSelectChange}
                    sortConfig={sortConfig}
                    onRequestSort={requestSort}
                    isDevMode={isDevMode}
                />
            )}

            {hasChanges && (
                <>
                    <CommitSection
                        status={status}
                        commitMessage={commitMessage}
                        setCommitMessage={setCommitMessage}
                        loadingAction={loadingAction}
                        hasIncomingChanges={status.incoming_changes.length > 0}
                        isDevMode={isDevMode}
                    />

                    <div className='mt-4 flex justify-end'>
                        <ActionButtons
                            isDevMode={isDevMode}
                            selectedOutgoingChanges={selectedOutgoingChanges}
                            selectedIncomingChanges={selectedIncomingChanges}
                            selectionType={selectionType}
                            commitMessage={commitMessage}
                            loadingAction={loadingAction}
                            onStageSelected={onStageSelected}
                            onCommitSelected={onCommitSelected}
                            onRevertSelected={onRevertSelected}
                            onPullSelected={onPullSelected}
                            getStageButtonTooltip={getStageButtonTooltip}
                            getCommitButtonTooltip={getCommitButtonTooltip}
                            getRevertButtonTooltip={getRevertButtonTooltip}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default StatusContainer;
