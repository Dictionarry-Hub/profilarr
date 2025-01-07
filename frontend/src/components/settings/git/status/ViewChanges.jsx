import React from 'react';
import PropTypes from 'prop-types';
import Modal from '../../../ui/Modal';
import DiffCommit from './DiffCommit';
import {FileText} from 'lucide-react';

const ViewChanges = ({isOpen, onClose, change, isIncoming}) => {
    const parseKey = key => {
        // Handle custom formats
        if (key.startsWith('custom_formats[')) {
            const formatName = key.match(/\[(.*?)\]/)?.[1] || '';
            return `Custom Format: ${formatName}`;
        }

        // Handle nested keys
        const parts = key.split('.');
        if (parts.length > 1) {
            return parts
                .map(part =>
                    part
                        .split(/[\[\]_]/)
                        .map(
                            word =>
                                word.charAt(0).toUpperCase() +
                                word.slice(1).toLowerCase()
                        )
                        .join(' ')
                )
                .join(': ');
        }

        // Handle special cases
        const specialTerms = {
            minimumcustomformatscore: 'Minimum Custom Format Score',
            minscoreincrement: 'Minimum Score Increment',
            upgradeuntilscore: 'Upgrade Until Score',
            upgradesallowed: 'Upgrades Allowed',
            customformat: 'Custom Format',
            qualitygroup: 'Quality Group'
        };

        const lowerKey = key.toLowerCase();
        if (specialTerms[lowerKey]) {
            return specialTerms[lowerKey];
        }

        // General formatting
        return key
            .split(/[\[\]_]/)
            .map(
                word =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join(' ')
            .trim();
    };

    const formatValue = value => {
        if (value === null || value === undefined || value === '~') return '-';

        if (Array.isArray(value)) {
            return value.length === 0 ? '[]' : value.join(', ');
        }

        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }

        return String(value);
    };

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
                            {change.changes.map((item, index) => (
                                <tr
                                    key={index}
                                    className='bg-gray-900 border-b border-gray-700'>
                                    <td className='py-4 px-4 text-gray-300'>
                                        {item.change.charAt(0).toUpperCase() +
                                            item.change.slice(1).toLowerCase()}
                                    </td>
                                    <td className='py-4 px-4'>
                                        <span className='font-medium text-gray-100'>
                                            {parseKey(item.key)}
                                        </span>
                                    </td>
                                    <td className='py-4 px-4 font-mono text-sm text-gray-300'>
                                        <div className='whitespace-pre-wrap'>
                                            {formatValue(item.from)}
                                        </div>
                                    </td>
                                    <td className='py-4 px-4 font-mono text-sm text-gray-300'>
                                        <div className='whitespace-pre-wrap'>
                                            {formatValue(item.to || item.value)}
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
