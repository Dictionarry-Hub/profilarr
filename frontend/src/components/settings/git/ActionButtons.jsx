import React from 'react';
import {Loader, RotateCcw, Download, CheckCircle, Plus} from 'lucide-react';
import Tooltip from '../../ui/Tooltip';

const ActionButton = ({
    onClick,
    disabled,
    loading,
    icon,
    text,
    className,
    disabledTooltip
}) => {
    const baseClassName =
        'flex items-center px-4 py-2 text-white rounded-md transition-all duration-200 ease-in-out text-xs';
    const enabledClassName = `${baseClassName} ${className} hover:opacity-80`;
    const disabledClassName = `${baseClassName} ${className} opacity-50 cursor-not-allowed`;

    return (
        <Tooltip content={disabled ? disabledTooltip : text}>
            <button
                onClick={onClick}
                className={disabled ? disabledClassName : enabledClassName}
                disabled={disabled || loading}>
                {loading ? (
                    <Loader size={12} className='animate-spin mr-1' />
                ) : (
                    React.cloneElement(icon, {className: 'mr-1', size: 12})
                )}
                {text}
            </button>
        </Tooltip>
    );
};

const ActionButtons = ({
    isDevMode,
    selectedOutgoingChanges,
    selectedIncomingChanges,
    selectionType,
    commitMessage,
    loadingAction,
    onStageSelected,
    onCommitSelected,
    onRevertSelected,
    onPullSelected
}) => {
    const canStage =
        isDevMode &&
        selectedOutgoingChanges.length > 0 &&
        selectionType !== 'staged';
    const canCommit =
        isDevMode &&
        selectedOutgoingChanges.length > 0 &&
        commitMessage.trim() &&
        selectionType !== 'unstaged';
    const canRevert = selectedOutgoingChanges.length > 0;
    const canPull = selectedIncomingChanges.length > 0;

    return (
        <div className='mt-4 flex justify-start space-x-2'>
            {isDevMode && (
                <>
                    <ActionButton
                        onClick={() => onStageSelected(selectedOutgoingChanges)}
                        disabled={!canStage}
                        loading={loadingAction === 'stage_selected'}
                        icon={<Plus />}
                        text='Stage'
                        className='bg-green-600'
                        disabledTooltip='Select unstaged files to enable staging'
                    />
                    <ActionButton
                        onClick={() =>
                            onCommitSelected(
                                selectedOutgoingChanges,
                                commitMessage
                            )
                        }
                        disabled={!canCommit}
                        loading={loadingAction === 'commit_selected'}
                        icon={<CheckCircle />}
                        text='Commit'
                        className='bg-blue-600'
                        disabledTooltip='Select staged files and enter a commit message to enable committing'
                    />
                </>
            )}
            <ActionButton
                onClick={() => onRevertSelected(selectedOutgoingChanges)}
                disabled={!canRevert}
                loading={loadingAction === 'revert_selected'}
                icon={<RotateCcw />}
                text='Revert'
                className='bg-red-600'
                disabledTooltip='Select files to revert'
            />
            <ActionButton
                onClick={() => onPullSelected(selectedIncomingChanges)}
                disabled={!canPull}
                loading={loadingAction === 'pull_changes'}
                icon={<Download />}
                text='Pull'
                className='bg-yellow-600'
                disabledTooltip='Select incoming changes to pull'
            />
        </div>
    );
};

export default ActionButtons;
