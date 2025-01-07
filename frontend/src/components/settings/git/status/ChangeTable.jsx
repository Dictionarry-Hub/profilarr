import React from 'react';
import {ArrowDown, ArrowUp} from 'lucide-react';
import ChangeRow from './ChangeRow';
import ConflictRow from './ConflictRow';

const ChangeTable = ({
    changes,
    isIncoming,
    isMergeConflict,
    selectedChanges,
    willBeSelected,
    onSelectChange,
    onMouseEnter,
    onMouseLeave,
    sortConfig,
    onRequestSort,
    fetchGitStatus
}) => {
    const sortedChanges = changesArray => {
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
                className={`py-2 px-4 text-left text-gray-400 font-medium cursor-pointer hover:bg-gray-700 ${className}`}
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

    const handleRowMouseDown = (e, change, index) => {
        // Prevent text selection when shift-clicking
        if (e.shiftKey) {
            e.preventDefault();
        }
    };

    return (
        <div className='rounded-lg border border-gray-700 overflow-hidden'>
            <table className='w-full'>
                <thead>
                    <tr className='bg-gray-800 border-b border-gray-700'>
                        <SortableHeader
                            sortKey='status'
                            className='w-1/5 rounded-tl-lg'>
                            Status
                        </SortableHeader>
                        <SortableHeader sortKey='type' className='w-1/5'>
                            Type
                        </SortableHeader>
                        <SortableHeader sortKey='name' className='w-1/2'>
                            Name
                        </SortableHeader>
                        <th className='py-2 px-4 text-right text-gray-400 font-medium w-1/5 rounded-tr-lg'>
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
                                fetchGitStatus={fetchGitStatus}
                            />
                        ) : (
                            <ChangeRow
                                key={`${
                                    isIncoming ? 'incoming' : 'outgoing'
                                }-${index}`}
                                change={change}
                                index={index}
                                isSelected={selectedChanges?.includes(
                                    change.file_path
                                )}
                                willBeSelected={willBeSelected?.includes(
                                    change.file_path
                                )}
                                onSelect={path =>
                                    onSelectChange(
                                        path,
                                        index,
                                        window.event?.shiftKey
                                    )
                                }
                                onMouseEnter={path =>
                                    onMouseEnter(
                                        path,
                                        index,
                                        window.event?.shiftKey
                                    )
                                }
                                onMouseLeave={onMouseLeave}
                                onMouseDown={e =>
                                    handleRowMouseDown(e, change, index)
                                }
                                isIncoming={isIncoming}
                            />
                        )
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default ChangeTable;
