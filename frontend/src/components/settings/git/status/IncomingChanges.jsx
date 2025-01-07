import React from 'react';
import {ArrowDownToLine, Download} from 'lucide-react';
import IconButton from '@ui/IconButton';
import ChangeTable from './ChangeTable';

const IncomingChanges = ({
    changes,
    onPullSelected,
    loadingAction,
    sortConfig,
    onRequestSort
}) => {
    if (!changes || changes.length === 0) return null;

    return (
        <div className='mb-4'>
            <div className='flex items-center justify-between mb-2'>
                <h4 className='text-sm font-medium text-gray-200 flex items-center'>
                    <ArrowDownToLine className='text-blue-400 mr-2' size={16} />
                    <span>Incoming Changes ({changes.length})</span>
                </h4>
                <IconButton
                    onClick={onPullSelected}
                    disabled={false}
                    loading={loadingAction === 'pull_changes'}
                    icon={<Download />}
                    tooltip='Pull'
                    className='bg-gray-700'
                />
            </div>
            <div className='overflow-hidden'>
                <ChangeTable
                    changes={changes}
                    isIncoming={true}
                    selectable={false}
                    selectedChanges={[]}
                    sortConfig={sortConfig}
                    onRequestSort={onRequestSort}
                />
            </div>
        </div>
    );
};

export default IncomingChanges;
