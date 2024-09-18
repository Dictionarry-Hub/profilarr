import React from 'react';
import PropTypes from 'prop-types';
import Modal from '../../../ui/Modal';

const Diff = ({
    isOpen,
    onClose,
    diffContent,
    type,
    name,
    commitMessage,
    title = 'View Diff'
}) => {
    const formatDiffContent = content => {
        if (!content) return [];
        return content.split('\n').map((line, index) => {
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

    const formattedContent = formatDiffContent(diffContent);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size='4xl'>
            <div className='space-y-4'>
                <div className='bg-gray-100 dark:bg-gray-700 p-4 rounded-lg space-y-2 text-sm'>
                    <div className='flex justify-between items-center'>
                        <span className='font-medium text-gray-600 dark:text-gray-300'>
                            Type:
                        </span>
                        <span className='bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded'>
                            {type}
                        </span>
                    </div>
                    <div className='flex justify-between items-center'>
                        <span className='font-medium text-gray-600 dark:text-gray-300'>
                            Name:
                        </span>
                        <span className='bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-2 py-1 rounded'>
                            {name === 'Deleted File' ? 'Deleted File' : name}
                        </span>
                    </div>
                    {commitMessage && (
                        <div className='flex flex-col'>
                            <span className='font-medium text-gray-600 dark:text-gray-300 mb-1'>
                                Commit Message:
                            </span>
                            <p className='bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 p-2 rounded'>
                                {commitMessage}
                            </p>
                        </div>
                    )}
                </div>
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

Diff.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    diffContent: PropTypes.string,
    type: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    commitMessage: PropTypes.string,
    title: PropTypes.string
};

export default Diff;
