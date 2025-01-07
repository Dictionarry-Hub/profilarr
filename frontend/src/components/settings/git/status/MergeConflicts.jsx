import React from 'react';
import {AlertTriangle, CheckCircle, XCircle} from 'lucide-react';
import Tooltip from '@ui/Tooltip';
import ConflictTable from './ConflictTable';

const MergeConflicts = ({
    conflicts,
    onMergeCommit,
    onAbortMerge,
    areAllConflictsResolved,
    fetchGitStatus
}) => {
    if (!conflicts || conflicts.length === 0) return null;

    return (
        <div className='mb-4'>
            <div className='flex items-center justify-between'>
                <h4 className='text-sm font-medium text-gray-200 flex items-center'>
                    <AlertTriangle className='text-yellow-400 mr-2' size={16} />
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
                            onClick={onMergeCommit}
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
                            onClick={onAbortMerge}
                            className='p-1.5 text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'>
                            <XCircle size={16} />
                        </button>
                    </Tooltip>
                </div>
            </div>
            <ConflictTable
                conflicts={conflicts}
                fetchGitStatus={fetchGitStatus}
            />
        </div>
    );
};

export default MergeConflicts;
