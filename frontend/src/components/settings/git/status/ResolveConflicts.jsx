import React, {useState, useEffect} from 'react';
import Modal from '@ui/Modal';
import {resolveConflict} from '@api/api';
import Alert from '@ui/Alert';
import {FileText} from 'lucide-react';

const ResolveConflicts = ({
    isOpen,
    onClose,
    change,
    isMergeConflict,
    fetchGitStatus
}) => {
    const [conflictResolutions, setConflictResolutions] = useState({});

    useEffect(() => {
        if (!isMergeConflict) {
            setConflictResolutions({});
        }
    }, [isMergeConflict, change]);

    const handleResolutionChange = (parameter, value) => {
        setConflictResolutions(prev => ({
            ...prev,
            [parameter]: value
        }));
    };

    const renderValue = value => {
        if (value === null) return 'null';
        if (Array.isArray(value)) {
            return value.length === 0 ? '[]' : value.join(', ');
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        return String(value);
    };

    const renderConflicts = () => {
        if (!change.conflict_details?.conflicting_parameters) return null;

        return (
            <div className='overflow-x-auto rounded-lg border border-gray-700'>
                <table className='min-w-full'>
                    <thead className='bg-gray-800 border-b border-gray-700'>
                        <tr>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium w-1/6'>
                                Parameter
                            </th>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium w-2/6'>
                                Local Value
                            </th>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium w-2/6'>
                                Incoming Value
                            </th>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium w-1/6'>
                                Resolution
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {change.conflict_details.conflicting_parameters.map(
                            (conflict, index) => (
                                <tr
                                    key={index}
                                    className='bg-gray-900 border-b border-gray-700'>
                                    <td className='py-4 px-4'>
                                        <span className='font-medium text-gray-100'>
                                            {conflict.parameter}
                                        </span>
                                    </td>
                                    <td className='py-4 px-4 font-mono text-sm text-gray-300'>
                                        <div className='whitespace-pre-wrap'>
                                            {renderValue(conflict.local_value)}
                                        </div>
                                    </td>
                                    <td className='py-4 px-4 font-mono text-sm text-gray-300'>
                                        <div className='whitespace-pre-wrap'>
                                            {renderValue(
                                                conflict.incoming_value
                                            )}
                                        </div>
                                    </td>
                                    <td className='py-4 px-4'>
                                        <select
                                            value={
                                                conflictResolutions[
                                                    conflict.parameter
                                                ] || ''
                                            }
                                            onChange={e =>
                                                handleResolutionChange(
                                                    conflict.parameter,
                                                    e.target.value
                                                )
                                            }
                                            className='w-full p-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-md
                                                 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent'>
                                            <option value='' disabled>
                                                Select
                                            </option>
                                            <option value='local'>
                                                Keep Local
                                            </option>
                                            <option value='incoming'>
                                                Accept Incoming
                                            </option>
                                        </select>
                                    </td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>
        );
    };

    const areAllConflictsResolved = () => {
        if (!change.conflict_details?.conflicting_parameters) return true;
        return change.conflict_details.conflicting_parameters.every(
            conflict => conflictResolutions[conflict.parameter]
        );
    };

    const handleResolveConflicts = async () => {
        try {
            const resolutions = {
                [change.file_path]: conflictResolutions
            };

            const result = await resolveConflict(resolutions);
            if (result.error) {
                Alert.warning(result.error);
                return;
            }

            Alert.success('Successfully resolved conflicts');
            await fetchGitStatus();
            onClose();
        } catch (error) {
            Alert.error(error.message || 'Failed to resolve conflicts');
        }
    };

    const titleContent = (
        <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-2'>
                <FileText className='w-5 h-5 text-gray-400' />
                <span className='text-lg font-bold'>{change.name}</span>
            </div>
            <span className='px-2 py-0.5 bg-yellow-500/20 text-yellow-200 rounded-full text-sm'>
                Merge Conflict
            </span>
            <span className='px-2 py-0.5 bg-gray-700 rounded-full text-sm text-gray-300'>
                {change.type}
            </span>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={titleContent}
            width='7xl'>
            <div className='space-y-4'>
                {renderConflicts()}

                {isMergeConflict && (
                    <div className='flex justify-end mt-6'>
                        <button
                            onClick={handleResolveConflicts}
                            disabled={!areAllConflictsResolved()}
                            className={`px-4 py-2 rounded-lg transition-colors ${
                                areAllConflictsResolved()
                                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-100'
                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}>
                            Resolve Conflicts
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ResolveConflicts;
