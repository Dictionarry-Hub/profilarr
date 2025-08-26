// components/settings/TaskCard.jsx
import React, {useState, useEffect} from 'react';
import {Play, Loader, Edit2, Check, X} from 'lucide-react';
import NumberInput from '@ui/NumberInput';
import {updateTaskInterval} from '@/api/task';

const TaskCard = ({task, onTrigger, isTriggering, isLast, onIntervalUpdate}) => {
    const [intervalValue, setIntervalValue] = useState(task.interval_minutes);
    const [originalValue, setOriginalValue] = useState(task.interval_minutes);
    
    // Only allow editing for Repository Sync and Backup tasks
    const isEditable = task.type === 'Sync' || task.type === 'Backup';
    const formatDateTime = dateString => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    };

    const formatDuration = duration => {
        if (!duration) return '-';
        return `${duration}s`;
    };

    useEffect(() => {
        setIntervalValue(task.interval_minutes);
        setOriginalValue(task.interval_minutes);
    }, [task.interval_minutes]);

    useEffect(() => {
        if (intervalValue !== originalValue && intervalValue > 0) {
            const updateInterval = async () => {
                const result = await updateTaskInterval(task.id, intervalValue);
                if (result.success) {
                    setOriginalValue(intervalValue);
                    // Refresh task data to get new next_run time
                    if (onIntervalUpdate) {
                        onIntervalUpdate();
                    }
                } else {
                    // Reset to original value if update failed
                    setIntervalValue(originalValue);
                }
            };
            updateInterval();
        }
    }, [intervalValue]);

    return (
        <tr className={`bg-gray-900 ${!isLast ? 'border-b border-gray-700' : ''}`}>
            <td className='py-4 px-4'>
                <div className='flex items-center space-x-3'>
                    <span className='font-medium text-gray-100'>
                        {task.name}
                    </span>
                </div>
            </td>
            <td className='py-4 px-4 text-gray-300'>
                {isEditable ? (
                    <div className='flex items-center space-x-2'>
                        <NumberInput
                            value={intervalValue}
                            onChange={setIntervalValue}
                            min={1}
                            max={43200}
                            step={1}
                            className='w-24'
                        />
                        <span className='text-gray-400 text-sm'>minutes</span>
                    </div>
                ) : (
                    <span>{task.interval_minutes} minutes</span>
                )}
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
