import React from 'react';
import {GitCommit, Info} from 'lucide-react';
import Tooltip from '@ui/Tooltip';

const DiffCommit = ({commitMessage}) => {
    const {subject, body} = commitMessage;

    const renderLine = (line, index) => {
        // Just handle basic bullet points (* or -)
        if (line.startsWith('* ') || line.startsWith('- ')) {
            return (
                <div key={index} className='flex items-center py-0.5'>
                    <span className='mr-2 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400' />
                    <span>{line.slice(2)}</span>
                </div>
            );
        }

        return (
            <div key={index} className='py-0.5'>
                {line}
            </div>
        );
    };

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
                                <div className='text-gray-300 text-sm'>
                                    {body
                                        .split('\n')
                                        .map((line, index) =>
                                            renderLine(line, index)
                                        )}
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default DiffCommit;
