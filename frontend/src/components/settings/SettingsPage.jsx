import React, {useState, useRef} from 'react';
import ArrContainer from './arrs/ArrContainer';
import TaskContainer from './tasks/TaskContainer';
import GitContainer from './git/GitContainer';
import BackupContainer from './backup/BackupContainer';
import LogContainer from './log/LogContainer';

const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState('git');
    const tabsRef = useRef({});

    const handleTabChange = tab => {
        setActiveTab(tab);
    };

    return (
        <div>
            <nav className='flex space-x-4 my-4'>
                <div
                    onClick={() => handleTabChange('git')}
                    ref={el => (tabsRef.current['git'] = el)}
                    className={`cursor-pointer px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === 'git'
                            ? 'bg-gray-600 border border-gray-600 text-white'
                            : 'bg-gray-800 border border-gray-700 text-white'
                    }`}>
                    Database
                </div>
                <div
                    onClick={() => handleTabChange('app')}
                    ref={el => (tabsRef.current['app'] = el)}
                    className={`cursor-pointer px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === 'app'
                            ? 'bg-gray-600 border border-gray-600 text-white'
                            : 'bg-gray-800 border border-gray-700 text-white'
                    }`}>
                    External Apps
                </div>
                <div
                    onClick={() => handleTabChange('tasks')}
                    ref={el => (tabsRef.current['tasks'] = el)}
                    className={`cursor-pointer px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === 'tasks'
                            ? 'bg-gray-600 border border-gray-600 text-white'
                            : 'bg-gray-800 border border-gray-700 text-white'
                    }`}>
                    Tasks
                </div>
                <div
                    onClick={() => handleTabChange('backup')}
                    ref={el => (tabsRef.current['backup'] = el)}
                    className={`cursor-pointer px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === 'backup'
                            ? 'bg-gray-600 border border-gray-600 text-white'
                            : 'bg-gray-800 border border-gray-700 text-white'
                    }`}>
                    Backups
                </div>
                <div
                    onClick={() => handleTabChange('logs')}
                    ref={el => (tabsRef.current['logs'] = el)}
                    className={`cursor-pointer px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === 'logs'
                            ? 'bg-gray-600 border border-gray-600 text-white'
                            : 'bg-gray-800 border border-gray-700 text-white'
                    }`}>
                    Logs
                </div>
            </nav>

            {activeTab === 'git' && <GitContainer />}
            {activeTab === 'app' && <ArrContainer />}
            {activeTab === 'tasks' && <TaskContainer />}
            {activeTab === 'backup' && <BackupContainer />}
            {activeTab === 'logs' && <LogContainer />}
        </div>
    );
};

export default SettingsPage;
