import React from 'react';
import PropTypes from 'prop-types';
import Modal from '@ui/Modal';
import DiffCommit from './DiffCommit';
import {FileText} from 'lucide-react';
import useChangeParser from '@hooks/useChangeParser';

const ViewChanges = ({isOpen, onClose, change, isIncoming}) => {
    // Parse the array of changes
    const parsedChanges = useChangeParser(change.changes || []);
    const titleContent = (
        <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-2'>
                <FileText className='w-5 h-5 text-gray-400' />
                <span className='text-lg font-bold'>{change.name}</span>
            </div>
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
                {/* If there's a commit message, show it */}
                {change.commit_message && (
                    <DiffCommit commitMessage={change.commit_message} />
                )}

                <div className='overflow-x-auto rounded-lg border border-gray-700'>
                    <table className='min-w-full'>
                        <thead className='bg-gray-800 border-b border-gray-700'>
                            <tr>
                                <th className='py-3 px-4 text-left text-gray-400 font-medium w-1/6'>
                                    Change
                                </th>
                                <th className='py-3 px-4 text-left text-gray-400 font-medium w-1/6'>
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
