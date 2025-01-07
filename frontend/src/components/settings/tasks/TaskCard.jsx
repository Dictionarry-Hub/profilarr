// components/settings/TaskCard.jsx
import React from 'react';
import {Play, Loader} from 'lucide-react';

const TaskCard = ({task, onTrigger, isTriggering}) => {
    const formatDateTime = dateString => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    };

    const formatDuration = duration => {
        if (!duration) return '-';
        return `${duration}s`;
    };

    return (
        <tr className='bg-gray-900 border-b border-gray-700'>
            <td className='py-4 px-4'>
                <div className='flex items-center space-x-3'>
                    <span className='font-medium text-gray-100'>
                        {task.name}
                    </span>
                </div>
            </td>
            <td className='py-4 px-4 text-gray-300'>
                {task.interval_minutes} minutes
            </td>
            <td className='py-4 px-4 text-gray-300'>
                {formatDateTime(task.last_run)}
            </td>
            <td className='py-4 px-4 text-gray-300'>
                {formatDateTime(task.next_run)}
            </td>
            <td className='py-4 px-4'>
                <button
                    onClick={() => onTrigger(task.id)}
                    disabled={isTriggering}
                    className='p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition-colors'>
                    {isTriggering ? (
                        <Loader className='animate-spin' size={16} />
                    ) : (
                        <Play size={16} />
                    )}
                </button>
            </td>
        </tr>
    );
};

export default TaskCard;
