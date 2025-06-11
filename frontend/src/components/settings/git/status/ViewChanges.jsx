import React from 'react';
import PropTypes from 'prop-types';
import Modal from '@ui/Modal';
import DiffCommit from './DiffCommit';
import {FileText, Info} from 'lucide-react';
import useChangeParser from '@hooks/useChangeParser';
import {COMMIT_TYPES, FILE_TYPES, COMMIT_SCOPES} from '@constants/commits';
import Tooltip from '@ui/Tooltip';

const Badge = ({icon: Icon, label, className, tooltipContent}) => (
    <Tooltip content={tooltipContent}>
        <div
            className={`px-2.5 py-1 rounded-md flex items-center gap-2 ${className}`}>
            <Icon className='w-3.5 h-3.5' />
            <span className='text-xs font-medium'>{label}</span>
        </div>
    </Tooltip>
);

const ViewChanges = ({isOpen, onClose, change, isIncoming}) => {
    const parsedChanges = useChangeParser(change.changes || []);
    const typeInfo = FILE_TYPES[change.type] || {
        bg: 'bg-gray-500/10',
        text: 'text-gray-400',
        icon: FileText
    };

    const commitType = COMMIT_TYPES.find(
        t => t.value === change.commit_message?.type
    );

    const titleContent = (
        <div className='flex items-center justify-between w-full mr-4'>
            <span className='text-lg font-bold text-gray-200'>
                {change.name}
            </span>
            <div className='flex items-center gap-3'>
                {commitType && (
                    <Badge
                        icon={commitType.icon}
                        label={commitType.label}
                        className={`${commitType.bg} ${commitType.text}`}
                        tooltipContent={commitType.description}
                    />
                )}
                <Badge
                    icon={typeInfo.icon}
                    label={change.type}
                    className={`${typeInfo.bg} ${typeInfo.text}`}
                    tooltipContent={
                        COMMIT_SCOPES.find(s => s.label === change.type)
                            ?.description
                    }
                />
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={titleContent}
            width='10xl'>
            <div className='space-y-4'>
                {change.commit_message && (
                    <DiffCommit commitMessage={change.commit_message} />
                )}

                {parsedChanges.length > 0 ? (
                    <div className='overflow-x-auto rounded-lg border border-gray-700'>
                        <table className='min-w-full'>
                            <thead className='bg-gray-800 border-b border-gray-700'>
                                <tr>
                                    <th className='py-3 px-4 text-left text-gray-400 font-medium w-1/8'>
                                        Change
                                    </th>
                                    <th className='py-3 px-4 text-left text-gray-400 font-medium w-2/8'>
                                        Key
                                    </th>
                                    <th className='py-3 px-4 text-left text-gray-400 font-medium w-2/6'>
                                        Previous
                                    </th>
                                    <th className='py-3 px-4 text-left text-gray-400 font-medium w-2/6'>
                                        Current
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedChanges.map(item => (
                                    <tr
                                        key={item.id}
                                        className='bg-gray-900 border-b border-gray-700'>
                                        <td className='py-4 px-4 text-gray-300'>
                                            {item.changeType}
                                        </td>
                                        <td className='py-4 px-4'>
                                            <span className='font-medium text-gray-100'>
                                                {item.key}
                                            </span>
                                        </td>
                                        <td className='py-4 px-4 font-mono text-sm text-gray-300'>
                                            <div className='whitespace-pre-wrap'>
                                                {item.from}
                                            </div>
                                        </td>
                                        <td className='py-4 px-4 font-mono text-sm text-gray-300'>
                                            <div className='whitespace-pre-wrap'>
                                                {item.to}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className='bg-gray-900 rounded-lg border border-gray-700 p-6'>
                        <div className='flex items-center space-x-3 text-blue-400'>
                            <Info size={20} />
                            <span className='font-medium'>Formatting Changes Only</span>
                            <span className='text-gray-400'>—</span>
                            <span className='text-sm text-gray-400'>
                                Only whitespace, indentation, or syntax changes detected. No content values were changed.
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

ViewChanges.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    change: PropTypes.object.isRequired,
    isIncoming: PropTypes.bool.isRequired
};

export default ViewChanges;
