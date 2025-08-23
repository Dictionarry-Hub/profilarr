// components/settings/TaskContainer.jsx
import React, {useState, useEffect} from 'react';
import {getAllTasks, triggerTask} from '@/api/task';
import {Loader} from 'lucide-react';
import Alert from '@ui/Alert';
import TaskCard from './TaskCard';

const TaskContainer = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [triggeringTask, setTriggeringTask] = useState(null);

    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchTasks = async () => {
        try {
            const taskData = await getAllTasks();
            setTasks(taskData);
        } catch (error) {
            Alert.error('Failed to fetch tasks');
        } finally {
            setLoading(false);
        }
    };

    const handleTriggerTask = async taskId => {
        setTriggeringTask(taskId);
        try {
            const result = await triggerTask(taskId);
            if (result.success) {
                Alert.success(result.message || 'Task triggered successfully');
                await fetchTasks();
            } else {
                Alert.error(result.message);
            }
        } finally {
            setTriggeringTask(null);
        }
    };

    if (loading) {
        return (
            <div className='flex items-center justify-center p-8'>
                <Loader className='animate-spin' size={24} />
            </div>
        );
    }

    return (
        <div className='space-y-4'>
            <h2 className='text-xl font-bold mb-4 text-gray-100'>
                Scheduled Tasks
            </h2>
            <div className='overflow-x-auto rounded-lg border border-gray-700'>
                <table className='min-w-full'>
                    <thead className='bg-gray-800 border-b border-gray-700'>
                        <tr>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium bg-gray-800'>
                                Name
                            </th>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium bg-gray-800'>
                                Interval
                            </th>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium bg-gray-800'>
                                Last Execution
                            </th>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium bg-gray-800'>
                                Next Execution
                            </th>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium bg-gray-800'>
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.map((task, index) => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onTrigger={handleTriggerTask}
                                isTriggering={triggeringTask === task.id}
                                isLast={index === tasks.length - 1}
                                onIntervalUpdate={fetchTasks}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TaskContainer;
