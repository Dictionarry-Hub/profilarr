import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import Modal from '../../../ui/Modal';
import DiffCommit from './DiffCommit';
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

    const parseKey = param => {
        return param
            .split('_')
            .map(
                word =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join(' ');
    };

    const formatDate = dateString => {
        const date = new Date(dateString);
        return date.toLocaleString();
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
        const basicFields = ['name', 'description'];
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
                    <td className='px-4 py-2.5 text-gray-300'>
                        {parseKey(parameter)}
                    </td>
                    <td className='px-4 py-2.5 text-gray-300'>{local_value}</td>
                    <td className='px-4 py-2.5 text-gray-300'>
                        {incoming_value}
                    </td>
                    <td className='px-4 py-2.5'>
                        <select
                            value={conflictResolutions[parameter] || ''}
                            onChange={e =>
                                handleResolutionChange(
                                    parameter,
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

        const formatConflict =
            change.conflict_details.conflicting_parameters.find(
                param => param.parameter === 'custom_formats'
            );

        if (!formatConflict) return null;

        const changedFormats = [];
        const localFormats = formatConflict.local_value;
        const incomingFormats = formatConflict.incoming_value;

        // Compare and find changed scores
        localFormats.forEach(localFormat => {
            const incomingFormat = incomingFormats.find(
                f => f.id === localFormat.id
            );
            if (incomingFormat && incomingFormat.score !== localFormat.score) {
                changedFormats.push({
                    id: localFormat.id,
                    name:
                        formatNames[localFormat.id] ||
                        `Format ${localFormat.id}`,
                    local_score: localFormat.score,
                    incoming_score: incomingFormat.score
                });
            }
        });

        if (changedFormats.length === 0) return null;

        return renderTable(
            'Custom Format Conflicts',
            [
                {label: 'Format', width: 'w-1/4'},
                {label: 'Local Score', width: 'w-1/4'},
                {label: 'Incoming Score', width: 'w-1/4'},
                {label: 'Resolution', width: 'w-1/4'}
            ],
            changedFormats,
            ({id, name, local_score, incoming_score}) => (
                <tr key={id} className='border-t border-gray-600'>
                    <td className='px-4 py-2.5 text-gray-300'>{name}</td>
                    <td className='px-4 py-2.5 text-gray-300'>{local_score}</td>
                    <td className='px-4 py-2.5 text-gray-300'>
                        {incoming_score}
                    </td>
                    <td className='px-4 py-2.5'>
                        <select
                            value={
                                conflictResolutions[`custom_format_${id}`] || ''
                            }
                            onChange={e =>
                                handleResolutionChange(
                                    `custom_format_${id}`,
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
            )
        );
    };

    const renderTagConflicts = () => {
        const tagConflict = change.conflict_details.conflicting_parameters.find(
            param => param.parameter === 'tags'
        );

        if (!tagConflict) return null;

        const localTags = new Set(tagConflict.local_value);
        const incomingTags = new Set(tagConflict.incoming_value);
        const allTags = [...new Set([...localTags, ...incomingTags])];

        const tagDiffs = allTags
            .filter(tag => localTags.has(tag) !== incomingTags.has(tag))
            .map(tag => ({
                tag,
                local_status: localTags.has(tag) ? 'present' : 'absent',
                incoming_status: incomingTags.has(tag) ? 'present' : 'absent'
            }));

        if (tagDiffs.length === 0) return null;

        return renderTable(
            'Tag Conflicts',
            [
                {label: 'Tag', width: 'w-1/4'},
                {label: 'Local Status', width: 'w-1/4'},
                {label: 'Incoming Status', width: 'w-1/4'},
                {label: 'Resolution', width: 'w-1/4'}
            ],
            tagDiffs,
            ({tag, local_status, incoming_status}) => (
                <tr key={tag} className='border-t border-gray-600'>
                    <td className='px-4 py-2.5 text-gray-300'>{tag}</td>
                    <td className='px-4 py-2.5 text-gray-300'>
                        {local_status}
                    </td>
                    <td className='px-4 py-2.5 text-gray-300'>
                        {incoming_status}
                    </td>
                    <td className='px-4 py-2.5'>
                        <select
                            value={conflictResolutions[`tag_${tag}`] || ''}
                            onChange={e =>
                                handleResolutionChange(
                                    `tag_${tag}`,
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
            )
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
            [change.conflict_details.conflicting_parameters[0]], // There's only one parameter for modify/delete
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

        const requiredResolutions = [];

        // Basic fields
        change.conflict_details.conflicting_parameters
            .filter(param => ['name', 'description'].includes(param.parameter))
            .forEach(param => requiredResolutions.push(param.parameter));

        // Custom formats (only for Quality Profiles)
        if (change.type === 'Quality Profile') {
            const formatConflict =
                change.conflict_details.conflicting_parameters.find(
                    param => param.parameter === 'custom_formats'
                );

            if (formatConflict) {
                const localFormats = formatConflict.local_value;
                const incomingFormats = formatConflict.incoming_value;

                localFormats.forEach(localFormat => {
                    const incomingFormat = incomingFormats.find(
                        f => f.id === localFormat.id
                    );
                    if (
                        incomingFormat &&
                        incomingFormat.score !== localFormat.score
                    ) {
                        requiredResolutions.push(
                            `custom_format_${localFormat.id}`
                        );
                    }
                });
            }
        }

        // Tags
        const tagConflict = change.conflict_details.conflicting_parameters.find(
            param => param.parameter === 'tags'
        );

        if (tagConflict) {
            const localTags = new Set(tagConflict.local_value);
            const incomingTags = new Set(tagConflict.incoming_value);
            const allTags = [...new Set([...localTags, ...incomingTags])];

            allTags.forEach(tag => {
                if (localTags.has(tag) !== incomingTags.has(tag)) {
                    requiredResolutions.push(`tag_${tag}`);
                }
            });
        }

        return requiredResolutions.every(key => conflictResolutions[key]);
    };

    const handleResolveConflicts = async () => {
        console.log('File path:', change.file_path);

        const resolutions = {
            [change.file_path]: conflictResolutions
        };

        console.log('Sending resolutions:', resolutions);

        try {
            const result = await resolveConflict(resolutions);
            Alert.success('Successfully resolved conflicts');
            if (result.error) {
                Alert.warning(result.error);
            }
        } catch (error) {
            Alert.error(error.message || 'Failed to resolve conflicts');
        }
    };

    // Title with status indicator
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
                    // For modify/delete conflicts, only show the file status
                    renderModifyDeleteConflict()
                ) : (
                    // For regular conflicts, show all the existing sections
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
