import React from 'react';
import {ArrowDown, ArrowUp} from 'lucide-react';
import ChangeRow from './ChangeRow';
import ConflictRow from './ConflictRow';

const ChangeTable = ({
    changes,
    isIncoming,
    isMergeConflict,
    selectedChanges,
    onSelectChange,
    sortConfig,
    onRequestSort,
    isDevMode,
    fetchGitStatus
}) => {
    const sortedChanges = changesArray => {
        // Don't sort if we're showing merge conflicts or if no sort config
        if (isMergeConflict || !sortConfig?.key) return changesArray;

        return [...changesArray].sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    };

    const SortableHeader = ({children, sortKey, className}) => {
        const isSorted = sortConfig.key === sortKey;
        return (
            <th
                className={`px-4 py-2 text-left text-gray-300 cursor-pointer hover:bg-gray-500 ${className}`}
                onClick={() => onRequestSort(sortKey)}>
                <div className='flex items-center'>
                    {children}
                    {isSorted &&
                        (sortConfig.direction === 'ascending' ? (
                            <ArrowUp size={14} className='ml-1' />
                        ) : (
                            <ArrowDown size={14} className='ml-1' />
                        ))}
                </div>
            </th>
        );
    };

    return (
        <table className='w-full text-sm'>
            <thead className='bg-gray-600'>
                <tr>
                    <SortableHeader sortKey='status' className='w-1/5'>
                        Status
                    </SortableHeader>
                    <SortableHeader sortKey='type' className='w-1/5'>
                        Type
                    </SortableHeader>
                    <SortableHeader sortKey='name' className='w-1/2'>
                        Name
                    </SortableHeader>
                    <th className='px-4 py-2 text-left text-gray-300 w-1/5'>
                        Actions
                    </th>
                </tr>
            </thead>
            <tbody>
                {sortedChanges(changes).map((change, index) =>
                    isMergeConflict ? (
                        <ConflictRow
                            key={`merge-conflict-${index}`}
                            change={change}
                            isDevMode={isDevMode}
                            fetchGitStatus={fetchGitStatus}
                        />
                    ) : (
                        <ChangeRow
                            key={`${
                                isIncoming ? 'incoming' : 'outgoing'
                            }-${index}`}
                            change={change}
                            isSelected={selectedChanges?.includes(
                                change.file_path
                            )}
                            onSelect={!isIncoming ? onSelectChange : null}
                            isIncoming={isIncoming}
                            isDevMode={isDevMode}
                        />
                    )
                )}
            </tbody>
        </table>
    );
};

export default ChangeTable;
