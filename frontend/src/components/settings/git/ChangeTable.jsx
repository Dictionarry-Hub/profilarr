import React from 'react';
import {ArrowDown, ArrowUp} from 'lucide-react';
import ChangeRow from './ChangeRow';

const ChangeTable = ({
    changes,
    title,
    icon,
    isIncoming,
    selectedChanges,
    onSelectChange,
    sortConfig,
    onRequestSort,
    isDevMode
}) => {
    const sortedChanges = changesArray => {
        if (!sortConfig.key) return changesArray;

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

    const SortableHeader = ({children, sortKey}) => {
        const isSorted = sortConfig.key === sortKey;
        return (
            <th
                className='px-4 py-2 text-left text-gray-300 cursor-pointer hover:bg-gray-500'
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
        <div className='mb-4'>
            <h4 className='text-sm font-medium text-gray-200 mb-4 flex items-center mt-3 '>
                {icon}
                <span>
                    {isIncoming
                        ? title
                        : isDevMode
                        ? 'Outgoing Changes'
                        : 'Local Changes'}{' '}
                    ({changes.length})
                </span>
            </h4>
            <div className='border border-gray-600 rounded-md overflow-hidden'>
                <table className='w-full text-sm'>
                    <thead className='bg-gray-600'>
                        <tr>
                            <SortableHeader sortKey='status'>
                                Status
                            </SortableHeader>
                            <SortableHeader sortKey='type'>Type</SortableHeader>
                            <SortableHeader sortKey='name'>Name</SortableHeader>
                            <th className='px-4 py-2 text-left text-gray-300 w-1/5'>
                                Actions
                            </th>
                            <th className='px-4 py-2 text-right text-gray-300 w-1/10'>
                                Select
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedChanges(changes).map((change, index) => (
                            <ChangeRow
                                key={`${
                                    isIncoming ? 'incoming' : 'outgoing'
                                }-${index}`}
                                change={change}
                                isSelected={selectedChanges.includes(
                                    change.file_path
                                )}
                                onSelect={filePath =>
                                    onSelectChange(filePath, isIncoming)
                                }
                                isIncoming={isIncoming}
                                isDevMode={isDevMode}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ChangeTable;
