import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import Modal from '../../../ui/Modal';
import Tooltip from '../../../ui/Tooltip';
import Alert from '../../../ui/Alert';
import {getFormats, resolveConflict} from '../../../../api/api';

const ResolveConflicts = ({
    isOpen,
    onClose,
    change,
    isIncoming,
    isMergeConflict,
    fetchGitStatus
}) => {
    const [formatNames, setFormatNames] = useState({});
    const [conflictResolutions, setConflictResolutions] = useState({});

    useEffect(() => {
        const fetchFormatNames = async () => {
            try {
                const formats = await getFormats();
                const namesMap = formats.reduce((acc, format) => {
                    acc[format.id] = format.name;
                    return acc;
                }, {});
                setFormatNames(namesMap);
            } catch (error) {
                console.error('Error fetching format names:', error);
            }
        };

        fetchFormatNames();
    }, []);

    useEffect(() => {
        if (!isMergeConflict) {
            setConflictResolutions({});
        }
    }, [isMergeConflict, change]);

    const handleResolutionChange = (key, value) => {
        setConflictResolutions(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const renderTable = (title, headers, data, renderRow) => {
        if (!data || data.length === 0) return null;

        return (
            <div className='mb-6'>
                <h4 className='text-md font-semibold text-gray-200 mb-2'>
                    {title}
                </h4>
                <div className='border border-gray-600 rounded-md overflow-hidden'>
                    <table className='w-full table-fixed'>
                        <thead className='bg-gray-600'>
                            <tr>
                                {headers.map((header, index) => (
                                    <th
                                        key={index}
                                        className={`px-4 py-2 text-left text-gray-300 ${header.width}`}>
                                        {header.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, index) => renderRow(item, index))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderBasicFields = () => {
        const basicFields = [
            'Description',
            'Language',
            'Minimum Custom Format Score',
            'Minimum Score Increment',
            'Upgrade Until Score',
            'Upgrades Allowed'
        ];
        const conflicts = change.conflict_details.conflicting_parameters.filter(
            param => basicFields.includes(param.parameter)
        );

        if (conflicts.length === 0) return null;

        return renderTable(
            'Basic Fields',
            [
                {label: 'Field', width: 'w-1/4'},
                {label: 'Local Value', width: 'w-1/4'},
                {label: 'Incoming Value', width: 'w-1/4'},
                {label: 'Resolution', width: 'w-1/4'}
            ],
            conflicts,
            ({parameter, local_value, incoming_value}) => (
                <tr key={parameter} className='border-t border-gray-600'>
                    <td className='px-4 py-2.5 text-gray-300'>{parameter}</td>
                    <td className='px-4 py-2.5 text-gray-300'>{local_value}</td>
                    <td className='px-4 py-2.5 text-gray-300'>
                        {incoming_value}
                    </td>
                    <td className='px-4 py-2.5'>
                        <select
                            value={
                                conflictResolutions[parameter.toLowerCase()] ||
                                ''
                            }
                            onChange={e =>
                                handleResolutionChange(
                                    parameter.toLowerCase(),
                                    e.target.value
                                )
                            }
                            className='w-full p-2 bg-gray-700 text-gray-200 rounded'>
                            <option value='' disabled>
                                Select
                            </option>
                            <option value='local'>Keep Local</option>
                            <option value='incoming'>Accept Incoming</option>
                        </select>
                    </td>
                </tr>
            )
        );
    };

    const renderCustomFormatConflicts = () => {
        if (change.type !== 'Quality Profile') return null;

        const formatConflicts =
            change.conflict_details.conflicting_parameters.filter(param =>
                param.parameter.startsWith('Custom Format:')
            );

        if (formatConflicts.length === 0) return null;

        return renderTable(
            'Custom Format Conflicts',
            [
                {label: 'Format', width: 'w-1/4'},
                {label: 'Local Score', width: 'w-1/4'},
                {label: 'Incoming Score', width: 'w-1/4'},
                {label: 'Resolution', width: 'w-1/4'}
            ],
            formatConflicts,
            ({parameter, local_value, incoming_value}) => {
                const formatName = parameter.split(':')[1].trim();
                const resolutionKey = `custom_format_${formatName}`;

                return (
                    <tr key={parameter} className='border-t border-gray-600'>
                        <td className='px-4 py-2.5 text-gray-300'>
                            {formatName}
                        </td>
                        <td className='px-4 py-2.5 text-gray-300'>
                            {local_value}
                        </td>
                        <td className='px-4 py-2.5 text-gray-300'>
                            {incoming_value}
                        </td>
                        <td className='px-4 py-2.5'>
                            <select
                                value={conflictResolutions[resolutionKey] || ''}
                                onChange={e =>
                                    handleResolutionChange(
                                        resolutionKey,
                                        e.target.value
                                    )
                                }
                                className='w-full p-2 bg-gray-700 text-gray-200 rounded'>
                                <option value='' disabled>
                                    Select
                                </option>
                                <option value='local'>Keep Local Score</option>
                                <option value='incoming'>
                                    Accept Incoming Score
                                </option>
                            </select>
                        </td>
                    </tr>
                );
            }
        );
    };

    const renderTagConflicts = () => {
        const tagConflicts =
            change.conflict_details.conflicting_parameters.filter(param =>
                param.parameter.startsWith('Tags:')
            );

        if (tagConflicts.length === 0) return null;

        return renderTable(
            'Tag Conflicts',
            [
                {label: 'Tag', width: 'w-1/4'},
                {label: 'Local Status', width: 'w-1/4'},
                {label: 'Incoming Status', width: 'w-1/4'},
                {label: 'Resolution', width: 'w-1/4'}
            ],
            tagConflicts,
            ({parameter, local_value, incoming_value}) => {
                const tagName = parameter.split(':')[1].trim();
                const resolutionKey = `tag_${tagName}`;

                return (
                    <tr key={parameter} className='border-t border-gray-600'>
                        <td className='px-4 py-2.5 text-gray-300'>{tagName}</td>
                        <td className='px-4 py-2.5 text-gray-300'>
                            {local_value.toString()}
                        </td>
                        <td className='px-4 py-2.5 text-gray-300'>
                            {incoming_value.toString()}
                        </td>
                        <td className='px-4 py-2.5'>
                            <select
                                value={conflictResolutions[resolutionKey] || ''}
                                onChange={e =>
                                    handleResolutionChange(
                                        resolutionKey,
                                        e.target.value
                                    )
                                }
                                className='w-full p-2 bg-gray-700 text-gray-200 rounded'>
                                <option value='' disabled>
                                    Select
                                </option>
                                <option value='local'>Keep Local Status</option>
                                <option value='incoming'>
                                    Accept Incoming Status
                                </option>
                            </select>
                        </td>
                    </tr>
                );
            }
        );
    };

    const renderModifyDeleteConflict = () => {
        if (change.status !== 'MODIFY_DELETE') return null;

        return renderTable(
            'File Status Conflict',
            [
                {label: 'Status', width: 'w-1/4'},
                {label: 'Local Version', width: 'w-1/4'},
                {label: 'Remote Version', width: 'w-1/4'},
                {label: 'Resolution', width: 'w-1/4'}
            ],
            [change.conflict_details.conflicting_parameters[0]],
            ({parameter, local_value, incoming_value}) => (
                <tr key={parameter} className='border-t border-gray-600'>
                    <td className='px-4 py-2.5 text-gray-300'>File</td>
                    <td className='px-4 py-2.5 text-gray-300'>
                        {local_value === 'deleted' ? 'Deleted' : 'Present'}
                    </td>
                    <td className='px-4 py-2.5 text-gray-300'>
                        {incoming_value === 'deleted' ? 'Deleted' : 'Present'}
                    </td>
                    <td className='px-4 py-2.5'>
                        <select
                            value={conflictResolutions['file'] || ''}
                            onChange={e =>
                                handleResolutionChange('file', e.target.value)
                            }
                            className='w-full p-2 bg-gray-700 text-gray-200 rounded'>
                            <option value='' disabled>
                                Select
                            </option>
                            <option value='local'>
                                {change.deleted_in_head
                                    ? 'Keep Deleted'
                                    : 'Keep File'}
                            </option>
                            <option value='incoming'>
                                {change.deleted_in_head
                                    ? 'Restore File'
                                    : 'Delete File'}
                            </option>
                        </select>
                    </td>
                </tr>
            )
        );
    };

    const areAllConflictsResolved = () => {
        if (!isMergeConflict) return true;

        // For modify/delete conflicts, only need to resolve the file status
        if (change.status === 'MODIFY_DELETE') {
            return !!conflictResolutions['file'];
        }

        // For all other conflicts, every parameter needs a resolution
        return change.conflict_details.conflicting_parameters.every(
            ({parameter}) => {
                // Convert backend parameter name to resolution key format
                let resolutionKey = parameter;

                // Check for known prefixes and convert appropriately
                if (parameter.startsWith('Custom Format: ')) {
                    // Extract the format ID from something like "Custom Format: 123: Score"
                    const formatId = parameter.split(': ')[1].split(':')[0];
                    resolutionKey = `custom_format_${formatId}`;
                } else if (parameter.startsWith('Tags: ')) {
                    // Extract just the tag name from "Tags: tagname"
                    const tagName = parameter.split(': ')[1];
                    resolutionKey = `tag_${tagName}`;
                } else {
                    // Convert other parameters to lowercase for basic fields
                    resolutionKey = parameter.toLowerCase();
                }

                return !!conflictResolutions[resolutionKey];
            }
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
        <div className='flex items-center space-x-2'>
            <span className='text-lg font-bold'>
                {change.type} - {change.name}
            </span>
            <span
                className={`px-2 py-1 rounded text-xs ${
                    isMergeConflict
                        ? 'bg-yellow-500'
                        : isIncoming
                        ? 'bg-blue-500'
                        : 'bg-green-500'
                }`}>
                {isMergeConflict
                    ? 'Merge Conflict'
                    : isIncoming
                    ? 'Incoming Change'
                    : 'Local Change'}
            </span>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={titleContent}
            width='5xl'>
            <div className='space-y-4'>
                {change.status === 'MODIFY_DELETE' ? (
                    renderModifyDeleteConflict()
                ) : (
                    <>
                        {renderBasicFields()}
                        {renderCustomFormatConflicts()}
                        {renderTagConflicts()}
                    </>
                )}

                {isMergeConflict && (
                    <div className='flex justify-end'>
                        <Tooltip
                            content={
                                !areAllConflictsResolved()
                                    ? 'Resolve all conflicts first!'
                                    : ''
                            }>
                            <button
                                onClick={handleResolveConflicts}
                                disabled={!areAllConflictsResolved()}
                                className={`px-4 py-2 rounded ${
                                    areAllConflictsResolved()
                                        ? 'bg-purple-500 hover:bg-purple-600 text-white'
                                        : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                }`}>
                                Resolve Conflicts
                            </button>
                        </Tooltip>
                    </div>
                )}
            </div>
        </Modal>
    );
};

ResolveConflicts.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    change: PropTypes.object.isRequired,
    isIncoming: PropTypes.bool.isRequired,
    isMergeConflict: PropTypes.bool,
    fetchGitStatus: PropTypes.func.isRequired
};

export default ResolveConflicts;
