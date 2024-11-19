import React, {useState, useEffect} from 'react';
import {Film, Tv, Headphones, Clock, Database, CheckCircle} from 'lucide-react';
import {pingService} from '../../../api/arr';

const ArrCard = ({title, type, serverUrl, apiKey, tags = [], onClick}) => {
    const [status, setStatus] = useState('unknown');
    const [isChecking, setIsChecking] = useState(false);

    const sampleData = {
        lastSync: new Date(Date.now() - 1000 * 60 * 30),
        syncStatus: {
            available: 1250,
            imported: 1250,
            percentage: 12
        }
    };

    const checkStatus = async () => {
        setIsChecking(true);
        try {
            const result = await pingService(serverUrl, apiKey, type);
            setStatus(result.success ? 'online' : 'offline');
        } catch {
            setStatus('offline');
        } finally {
            setIsChecking(false);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 60000);
        return () => clearInterval(interval);
    }, [serverUrl, apiKey]);

    const getIcon = () => {
        const lowerName = title.toLowerCase();
        if (lowerName.includes('radarr')) return Film;
        if (lowerName.includes('sonarr')) return Tv;
        if (lowerName.includes('lidarr')) return Headphones;
        return Film;
    };

    const Icon = getIcon();

    const getStatusColor = () => {
        if (isChecking) return 'bg-yellow-400';
        switch (status) {
            case 'online':
                return 'bg-emerald-400';
            case 'offline':
                return 'bg-red-400';
            default:
                return 'bg-gray-400';
        }
    };

    const formatTimeAgo = date => {
        const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    };

    return (
        <div
            onClick={onClick}
            className='group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 cursor-pointer p-3 h-24'>
            {/* Main Content */}
            <div className='flex flex-col h-full justify-between'>
                {/* Header */}
                <div className='flex items-center justify-between'>
                    <div className='flex items-center space-x-2'>
                        <Icon size={16} className='text-blue-500' />
                        <span className='font-medium text-sm text-gray-900 dark:text-gray-100'>
                            {title}
                        </span>
                        <div
                            className={`w-1.5 h-1.5 rounded-full ${getStatusColor()} ${
                                isChecking ? 'animate-pulse' : ''
                            }`}
                        />
                    </div>
                    <div className='flex gap-1'>
                        {tags.map(tag => (
                            <span
                                key={tag}
                                className='bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-[8px] px-1.5 rounded-full'>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Footer Stats */}
                <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
                    <div className='flex items-center space-x-1'>
                        <Database size={12} />
                        <span>{sampleData.syncStatus.percentage}%</span>
                        {sampleData.syncStatus.percentage === 100 && (
                            <CheckCircle size={12} className='text-green-500' />
                        )}
                    </div>
                    <div className='flex items-center space-x-1'>
                        <Clock size={12} />
                        <span>
                            Last Synced: {formatTimeAgo(sampleData.lastSync)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArrCard;
