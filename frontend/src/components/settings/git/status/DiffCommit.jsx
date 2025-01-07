import React from 'react';
import PropTypes from 'prop-types';

const DiffCommit = ({commitMessage}) => {
    if (!commitMessage) return null;

    const {subject, body, footer} = commitMessage;

    return (
        <div className='bg-gray-100 dark:bg-gray-800 p-4 rounded-lg'>
            <div className='mb-2'>
                <span className='text-xl font-semibold text-gray-700 dark:text-gray-300 mr-3'>
                    Details
                </span>
            </div>
            <div className='flex items-start space-x-3'>
                <div className='flex-1'>
                    <div className='mb-2'>
                        <span className='text-sm font-semibold text-gray-700 dark:text-gray-300 mr-3'>
                            {subject}
                        </span>
                    </div>

                    {/* Render the body without double hyphens */}
                    {body && (
                        <ul className='list-disc pl-5 space-y-1'>
                            {body
                                .split('\n')
                                .filter(line => line.trim().startsWith('-')) // Ensure we only take lines starting with "-"
                                .map((line, index) => (
                                    <li
                                        key={index}
                                        className='text-sm text-gray-600 dark:text-gray-400'>
                                        {line.trim().replace(/^-\s*/, '')}{' '}
                                        {/* Remove leading hyphen */}
                                    </li>
                                ))}
                        </ul>
                    )}

                    {/* Render the footer if it exists */}
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
        type: PropTypes.string,
        scope: PropTypes.string,
        subject: PropTypes.string.isRequired,
        body: PropTypes.string,
        footer: PropTypes.string
    })
};

export default DiffCommit;
