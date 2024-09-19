import React from 'react';
import PropTypes from 'prop-types';
import Modal from '../../../ui/Modal';
import DiffCommit from './DiffCommit';

const ViewDiff = ({
    isOpen,
    onClose,
    diffContent,
    type,
    name,
    commitMessage,
    isIncoming
}) => {
    const formatDiffContent = content => {
        if (!content) return [];
        const lines = content.split('\n');
        // Remove the first 5 lines (git diff header)
        const contentWithoutHeader = lines.slice(5);
        return contentWithoutHeader.map((line, index) => {
            let lineClass = 'py-1 pl-4 border-l-2 ';
            if (line.startsWith('+')) {
                lineClass += 'bg-green-900/30 text-green-400 border-green-500';
            } else if (line.startsWith('-')) {
                lineClass += 'bg-red-900/30 text-red-400 border-red-500';
            } else {
                lineClass += 'border-transparent';
            }
            return (
                <div key={index} className={`flex ${lineClass}`}>
                    <span className='w-12 text-gray-500 select-none text-right pr-4 border-r border-gray-700'>
                        {index + 1}
                    </span>
                    <code className='flex-1 pl-4 font-mono text-sm'>
                        {line}
                    </code>
                </div>
            );
        });
    };

    // Tag background colors based on the type and scope
    const typeColors = {
        'New Feature':
            'bg-green-100 text-white-800 dark:bg-green-900 dark:text-white-200',
        'Bug Fix':
            'bg-red-100 text-white-800 dark:bg-red-900 dark:text-white-200',
        Documentation:
            'bg-yellow-100 text-white-800 dark:bg-yellow-900 dark:text-white-200',
        'Style Change':
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        Refactoring:
            'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        'Performance Improvement':
            'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
        'Test Addition/Modification':
            'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
        'Chore/Maintenance':
            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    };

    const scopeColors = {
        'Regex Pattern':
            'bg-blue-100 text-white-800 dark:bg-blue-900 dark:text-white-200',
        'Custom Format':
            'bg-green-100 text-white-800 dark:bg-green-900 dark:text-white-200',
        'Quality Profile':
            'bg-yellow-100 text-white-800 dark:bg-yellow-900 dark:text-white-200'
    };

    const renderTag = (label, colorClass) => (
        <span
            className={`inline-block px-2 py-1 rounded text-xs font-medium mr-2 ${colorClass}`}>
            {label}
        </span>
    );

    const titleContent = (
        <div className='flex items-center space-x-2 flex-wrap'>
            <span>{name}</span>
            <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                    isIncoming
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`}>
                {isIncoming ? 'Incoming' : 'Outgoing'}
            </span>
            {commitMessage &&
                commitMessage.type &&
                renderTag(
                    commitMessage.type,
                    typeColors[commitMessage.type] ||
                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                )}
            {commitMessage &&
                commitMessage.scope &&
                renderTag(
                    commitMessage.scope,
                    scopeColors[commitMessage.scope] ||
                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                )}
        </div>
    );

    const formattedContent = formatDiffContent(diffContent);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={titleContent}
            width='3xl'>
            <div className='space-y-4'>
                <DiffCommit commitMessage={commitMessage} />
                <div className='border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden'>
                    <div className='bg-gray-50 dark:bg-gray-800 p-2 text-sm font-medium text-gray-600 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600'>
                        Diff Content
                    </div>
                    <div className='bg-white dark:bg-gray-900 p-4 max-h-[60vh] overflow-y-auto'>
                        {formattedContent.length > 0 ? (
                            formattedContent
                        ) : (
                            <div className='text-gray-500 dark:text-gray-400 italic'>
                                No differences found or file is empty.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

ViewDiff.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    diffContent: PropTypes.string,
    type: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    commitMessage: PropTypes.shape({
        type: PropTypes.string,
        scope: PropTypes.string,
        subject: PropTypes.string,
        body: PropTypes.string,
        footer: PropTypes.string
    }),
    isIncoming: PropTypes.bool.isRequired
};

export default ViewDiff;
