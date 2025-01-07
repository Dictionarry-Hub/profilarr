import React from 'react';
import {
    ArrowUpFromLine,
    Plus,
    MinusCircle,
    GitCommitHorizontal,
    Upload,
    RotateCcw
} from 'lucide-react';
import IconButton from '@ui/IconButton';
import ChangeTable from './ChangeTable';

const OutgoingChanges = ({
    changes,
    unpushedFiles,
    hasUnpushedCommits,
    selectedChanges,
    willBeSelected,
    onSelectChange,
    onMouseEnter,
    onMouseLeave,
    onStageSelected,
    onUnstageSelected,
    onCommitSelected,
    onPushSelected,
    onRevertSelected,
    loadingAction,
    sortConfig,
    onRequestSort,
    selectionType,
    commitMessage,
    canCommit,
    getButtonTooltips
}) => {
    if ((!changes || changes.length === 0) && !hasUnpushedCommits) return null;

    const totalOutgoingChanges = changes.length;
    const totalUnpushedCommits = unpushedFiles?.length || 0;

    return (
        <div className='mb-4'>
            <div className='flex items-center justify-between mb-2'>
                <h4 className='text-sm font-medium text-gray-200 flex items-center'>
                    <ArrowUpFromLine className='text-blue-400 mr-2' size={16} />
                    <span>
                        Outgoing Changes (
                        {totalOutgoingChanges + totalUnpushedCommits})
                    </span>
                </h4>
                <div className='space-x-2 flex'>
                    <IconButton
                        onClick={() => onStageSelected(selectedChanges)}
                        disabled={
                            selectionType !== 'unstaged' ||
                            selectedChanges.length === 0
                        }
                        loading={loadingAction === 'stage_selected'}
                        icon={<Plus />}
                        tooltip='Stage'
                        className='bg-gray-700'
                        disabledTooltip={getButtonTooltips.stage()}
                    />
                    <IconButton
                        onClick={() => onUnstageSelected(selectedChanges)}
                        disabled={
                            selectionType !== 'staged' ||
                            selectedChanges.length === 0
                        }
                        loading={loadingAction === 'unstage_selected'}
                        icon={<MinusCircle />}
                        tooltip='Unstage'
                        className='bg-gray-700'
                        disabledTooltip={getButtonTooltips.unstage()}
                    />
                    <IconButton
                        onClick={() =>
                            onCommitSelected(selectedChanges, commitMessage)
                        }
                        disabled={!canCommit}
                        loading={loadingAction === 'commit_selected'}
                        icon={<GitCommitHorizontal />}
                        tooltip='Commit'
                        className='bg-gray-700'
                        disabledTooltip={getButtonTooltips.commit()}
                    />
                    {hasUnpushedCommits && (
                        <IconButton
                            onClick={onPushSelected}
                            disabled={!hasUnpushedCommits}
                            loading={loadingAction === 'push_changes'}
                            icon={<Upload />}
                            tooltip={
                                <div>
                                    <div>Push Changes</div>
                                    {unpushedFiles?.length > 0 && (
                                        <div className='mt-1 text-xs'>
                                            {unpushedFiles.map(
                                                (file, index) => (
                                                    <div key={index}>
                                                        • {file.type}:{' '}
                                                        {file.name}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            }
                            className='bg-gray-700'
                            disabledTooltip='No changes to push'
                        />
                    )}
                    <IconButton
                        onClick={() => onRevertSelected(selectedChanges)}
                        disabled={selectedChanges.length === 0}
                        loading={loadingAction === 'revert_selected'}
                        icon={<RotateCcw />}
                        tooltip='Revert'
                        className='bg-gray-700'
                        disabledTooltip={getButtonTooltips.revert()}
                    />
                </div>
            </div>
            {changes.length > 0 && (
                <div className='overflow-hidden'>
                    <ChangeTable
                        changes={changes}
                        isIncoming={false}
                        selectedChanges={selectedChanges}
                        willBeSelected={willBeSelected}
                        onSelectChange={onSelectChange}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        sortConfig={sortConfig}
                        onRequestSort={onRequestSort}
                    />
                </div>
            )}
        </div>
    );
};

export default OutgoingChanges;
