import React from 'react';
import PropTypes from 'prop-types';
import {GitCommit} from 'lucide-react';

const DiffCommit = ({commitMessage}) => {
    if (!commitMessage) return null;

    const {type, scope, subject, body, footer} = commitMessage;

    return (
        <div className='bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-sm'>
            <div className='flex items-start space-x-3'>
                <GitCommit
                    className='text-gray-500 dark:text-gray-400 mt-1'
                    size={16}
                />
                <div className='flex-1'>
                    <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                        Commit Message
                    </h4>
                    <div className='mb-2'>
                        <span className='inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-2'>
                            {type}
                        </span>
                        <span className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
                            {`${scope ? `(${scope})` : ''} ${subject}`}
                        </span>
                    </div>
                    {body && (
                        <ul className='list-disc pl-5 space-y-1'>
                            {body.split('\n').map((line, index) => (
                                <li
                                    key={index}
                                    className='text-sm text-gray-600 dark:text-gray-400'>
                                    {line.trim()}
                                </li>
                            ))}
                        </ul>
                    )}
                    {footer && (
                        <div className='mt-2 text-sm text-gray-600 dark:text-gray-400'>
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

DiffCommit.propTypes = {
    commitMessage: PropTypes.shape({
        type: PropTypes.string.isRequired,
        scope: PropTypes.string,
        subject: PropTypes.string.isRequired,
        body: PropTypes.string,
        footer: PropTypes.string
    })
};

export default DiffCommit;
