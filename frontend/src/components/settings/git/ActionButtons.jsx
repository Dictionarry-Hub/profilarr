import React from 'react';
import {
    Loader,
    RotateCcw,
    Download,
    CheckCircle,
    Plus,
    Upload
} from 'lucide-react';
import Tooltip from '../../ui/Tooltip';

const ActionButtons = ({
    isDevMode,
    selectedOutgoingChanges,
    selectionType,
    commitMessage,
    loadingAction,
    onStageSelected,
    onCommitSelected,
    onPushSelected,
    onRevertSelected,
    hasUnpushedCommits
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

    const canPush = isDevMode && hasUnpushedCommits;
    const canRevert = selectedOutgoingChanges.length > 0;

    return (
        <div className='space-x-2 flex flex-wrap gap-2'>
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
                    <ActionButton
                        onClick={onPushSelected}
                        disabled={!canPush}
                        loading={loadingAction === 'push_changes'}
                        icon={<Upload />}
                        text={`Push${hasUnpushedCommits ? ' Changes' : ''}`}
                        className='bg-purple-600'
                        disabledTooltip={
                            hasUnpushedCommits ? '' : 'No changes to push'
                        }
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
        </div>
    );
};

const ActionButton = ({
    onClick,
    disabled,
    loading,
    icon,
    tooltip,
    className,
    disabledTooltip
}) => {
    const baseClassName =
        'flex items-center justify-center w-8 h-8 text-white rounded-md transition-all duration-200 ease-in-out hover:opacity-80';
    const buttonClassName = `${baseClassName} ${className} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
    }`;

    return (
        <Tooltip content={disabled ? disabledTooltip : tooltip}>
            <button
                onClick={onClick}
                className={buttonClassName}
                disabled={disabled || loading}>
                {loading ? (
                    <Loader size={14} className='animate-spin' />
                ) : (
                    React.cloneElement(icon, {size: 14})
                )}
            </button>
        </Tooltip>
    );
};

export default ActionButtons;
