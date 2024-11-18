// ConflictRow.jsx
import React, {useState} from 'react';
import {AlertTriangle, GitMerge, Check, Edit2} from 'lucide-react';
import Tooltip from '../../ui/Tooltip';
import ResolveConflicts from './modal/ResolveConflicts';

const ConflictRow = ({change, isDevMode, fetchGitStatus}) => {
    console.log('ConflictRow change:', JSON.stringify(change, null, 2));
    const [showChanges, setShowChanges] = useState(false);

    const handleResolveConflicts = e => {
        e.stopPropagation();
        setShowChanges(true);
    };

    // Get name values from the correct path in the data structure
    const nameConflict = change.conflict_details?.conflicting_parameters?.find(
        param => param.parameter === 'name'
    );

    const displayLocalName =
        nameConflict?.local_value || change.name || 'Unnamed';
    const displayIncomingName = nameConflict?.incoming_value || 'Unnamed';

    const isResolved = change.status === 'RESOLVED';

    // Check if this is a modify/delete conflict
    const fileConflict = change.conflict_details?.conflicting_parameters?.find(
        param => param.parameter === 'file'
    );
    const isModifyDelete = !!fileConflict;

    // Determine if button should be disabled
    const isButtonDisabled = isModifyDelete && isResolved;

    return (
        <>
            <tr className='border-t border-gray-600'>
                <td className='px-4 py-2 text-gray-300'>
                    <div className='flex items-center'>
                        {isResolved ? (
                            <Check className='text-green-400' size={16} />
                        ) : (
                            <AlertTriangle
                                className='text-yellow-400'
                                size={16}
                            />
                        )}
                        <span className='ml-2'>
                            {isResolved ? 'Resolved' : 'Unresolved'}
                        </span>
                    </div>
                </td>
                <td className='px-4 py-2 text-gray-300'>{change.type}</td>
                <td className='px-4 py-2 text-gray-300'>
                    {displayLocalName !== displayIncomingName ? (
                        <>
                            <span className='mr-3'>
                                <strong>Local:</strong> {displayLocalName}
                            </span>
                            <span>
                                <strong>Incoming:</strong> {displayIncomingName}
                            </span>
                        </>
                    ) : (
                        displayLocalName
                    )}
                </td>
                <td className='px-4 py-2 text-left align-middle'>
                    <Tooltip
                        content={
                            isButtonDisabled
                                ? 'Abort to try again'
                                : isResolved
                                ? 'Edit resolution'
                                : 'Resolve conflicts'
                        }>
                        <button
                            onClick={
                                isButtonDisabled
                                    ? undefined
                                    : handleResolveConflicts
                            }
                            disabled={isButtonDisabled}
                            className={`flex items-center justify-center px-2 py-1 rounded transition-colors text-xs w-full ${
                                isButtonDisabled
                                    ? 'bg-gray-500 text-gray-400 cursor-not-allowed'
                                    : isResolved
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-gray-600 hover:bg-gray-700'
                            }`}>
                            {isResolved ? (
                                <>
                                    <Edit2 size={12} className='mr-1' />
                                    Edit
                                </>
                            ) : (
                                <>
                                    <GitMerge size={12} className='mr-1' />
                                    Resolve
                                </>
                            )}
                        </button>
                    </Tooltip>
                </td>
            </tr>
            {!isButtonDisabled && (
                <ResolveConflicts
                    key={`${change.file_path}-changes`}
                    isOpen={showChanges}
                    onClose={() => setShowChanges(false)}
                    change={change}
                    isIncoming={false}
                    isMergeConflict={true}
                    fetchGitStatus={fetchGitStatus}
                    isDevMode={isDevMode}
                />
            )}
        </>
    );
};
export default ConflictRow;
