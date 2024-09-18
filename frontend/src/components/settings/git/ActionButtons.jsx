import React from 'react';
import {Loader, RotateCcw, Download, CheckCircle, Plus} from 'lucide-react';
import Tooltip from '../../ui/Tooltip';

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
    onPullSelected,
    getStageButtonTooltip,
    getCommitButtonTooltip,
    getRevertButtonTooltip
}) => {
    return (
        <div className='mt-4 flex justify-end space-x-2'>
            {isDevMode && (
                <>
                    {/* Stage */}
                    {selectedOutgoingChanges.length > 0 &&
                        selectionType !== 'staged' && (
                            <Tooltip content={getStageButtonTooltip()}>
                                <button
                                    onClick={() =>
                                        onStageSelected(selectedOutgoingChanges)
                                    }
                                    className='flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 ease-in-out text-xs'
                                    disabled={
                                        loadingAction === 'stage_selected'
                                    }>
                                    {loadingAction === 'stage_selected' ? (
                                        <Loader
                                            size={12}
                                            className='animate-spin'
                                        />
                                    ) : (
                                        <Plus className='mr-1' size={12} />
                                    )}
                                    Stage Selected
                                </button>
                            </Tooltip>
                        )}
                    {/* Commit */}
                    {selectedOutgoingChanges.length > 0 &&
                        commitMessage.trim() &&
                        selectionType !== 'unstaged' && (
                            <Tooltip content={getCommitButtonTooltip()}>
                                <button
                                    onClick={() =>
                                        onCommitSelected(
                                            selectedOutgoingChanges,
                                            commitMessage
                                        )
                                    }
                                    className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 ease-in-out text-xs'
                                    disabled={
                                        loadingAction === 'commit_selected'
                                    }>
                                    {loadingAction === 'commit_selected' ? (
                                        <Loader
                                            size={12}
                                            className='animate-spin'
                                        />
                                    ) : (
                                        <CheckCircle
                                            className='mr-1'
                                            size={12}
                                        />
                                    )}
                                    Commit Selected
                                </button>
                            </Tooltip>
                        )}
                </>
            )}
            {/* Revert */}
            {selectedOutgoingChanges.length > 0 && (
                <Tooltip content={getRevertButtonTooltip()}>
                    <button
                        onClick={() =>
                            onRevertSelected(selectedOutgoingChanges)
                        }
                        className='flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 ease-in-out text-xs'
                        disabled={loadingAction === 'revert_selected'}>
                        {loadingAction === 'revert_selected' ? (
                            <Loader size={12} className='animate-spin' />
                        ) : (
                            <RotateCcw className='mr-1' size={12} />
                        )}
                        Revert Selected
                    </button>
                </Tooltip>
            )}
            {/* Pull */}
            {selectedIncomingChanges.length > 0 && (
                <Tooltip content='Pull selected changes'>
                    <button
                        onClick={() => onPullSelected(selectedIncomingChanges)}
                        className='flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors duration-200 ease-in-out text-xs'
                        disabled={loadingAction === 'pull_changes'}>
                        {loadingAction === 'pull_changes' ? (
                            <Loader size={12} className='animate-spin' />
                        ) : (
                            <Download className='mr-1' size={12} />
                        )}
                        Pull Selected
                    </button>
                </Tooltip>
            )}
        </div>
    );
};

export default ActionButtons;
