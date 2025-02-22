import React from 'react';
import {GitCommit, Code, FileText, Settings, File} from 'lucide-react';

const PushRow = ({change}) => {
    const getTypeIcon = type => {
        switch (type) {
            case 'Regex Pattern':
                return <Code className='text-blue-400' size={16} />;
            case 'Custom Format':
                return <FileText className='text-green-400' size={16} />;
            case 'Quality Profile':
                return <Settings className='text-purple-400' size={16} />;
            default:
                return <File className='text-gray-400' size={16} />;
        }
    };

    return (
        <tr className='bg-gray-900'>
            <td className='py-2 px-4 text-gray-300'>
                <div className='flex items-center'>
                    <GitCommit className='text-blue-400' size={16} />
                    <span className='ml-2'>Committed</span>
                </div>
            </td>
            <td className='py-2 px-4 text-gray-300'>
                <div className='flex items-center'>
                    {getTypeIcon(change.type)}
                    <span className='ml-2'>{change.type}</span>
                </div>
            </td>
            <td className='py-2 px-4 text-gray-300'>
                <span>{change.name.replace('.yml', '')}</span>
            </td>
        </tr>
    );
};

export default PushRow;
