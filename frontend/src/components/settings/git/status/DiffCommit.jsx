import React from 'react';
import PropTypes from 'prop-types';
import {GitCommit, Info} from 'lucide-react';
import Tooltip from '@ui/Tooltip';

const DiffCommit = ({commitMessage}) => {
    const {subject, body} = commitMessage;

    return (
        <div className='overflow-hidden rounded-lg border border-gray-700'>
            <table className='w-full'>
                <tbody>
                    {/* Subject row */}
                    <tr className='bg-gray-800'>
                        <td className='py-3 px-4'>
                            <div className='flex items-center justify-between'>
                                <div className='flex items-center space-x-3'>
                                    <GitCommit className='w-5 h-5 text-blue-400' />
                                    <span className='text-gray-200 font-medium'>
                                        {subject}
                                    </span>
                                </div>
                                <Tooltip content='Additional information about the incoming change'>
                                    <Info className='w-4 h-4 text-gray-400' />
                                </Tooltip>
                            </div>
                        </td>
                    </tr>

                    {/* Body row - only rendered if body exists */}
                    {body && (
                        <tr className='bg-gray-900'>
                            <td className='py-3 px-4'>
                                <div className='text-gray-300 text-sm whitespace-pre-wrap'>
                                    {body.split('\n').map((line, index) => (
                                        <div
                                            key={index}
                                            className={`${
                                                line.startsWith('- ')
                                                    ? 'ml-4'
                                                    : ''
                                            }`}>
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

DiffCommit.propTypes = {
    commitMessage: PropTypes.shape({
        subject: PropTypes.string.isRequired,
        body: PropTypes.string
    })
};

export default DiffCommit;
