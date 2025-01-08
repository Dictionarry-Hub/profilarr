import React from 'react';
import {Clock, ArrowUpDown, BarChart} from 'lucide-react';
import RadarrLogo from '@logo/Radarr.svg';
import SonarrLogo from '@logo/Sonarr.svg';

const ArrCard = ({
    title,
    type,
    sync_percentage = 0,
    last_sync_time,
    sync_method,
    sync_interval,
    tags = [],
    data_to_sync = {},
    import_as_unique,
    onClick
}) => {
    // Format last sync time
    const formatLastSync = timestamp => {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    // Get sync method display
    const getSyncMethodDisplay = () => {
        switch (sync_method) {
            case 'pull':
                return 'On Pull';
            case 'schedule':
                return `Scheduled (${sync_interval}m)`;
            case 'manual':
                return 'Manual';
            default:
                return 'Unknown';
        }
    };

    const syncMethodDisplay = getSyncMethodDisplay();

    return (
        <div
            onClick={onClick}
            className='bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 
                 shadow-xl hover:shadow-2xl hover:border-blue-500/50 transition-all duration-200 
                 cursor-pointer overflow-hidden group'>
            <div className='p-4 space-y-4'>
                {/* Header with Logo, Title, and Tags */}
                <div className='flex items-start justify-between'>
                    <div className='flex items-center space-x-3'>
                        <div className='p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors'>
                            <img
                                src={
                                    type === 'radarr' ? RadarrLogo : SonarrLogo
                                }
                                className='w-5 h-5'
                                alt={type === 'radarr' ? 'Radarr' : 'Sonarr'}
                            />
                        </div>
                        <div>
                            <h3 className='font-medium text-gray-100'>
                                {title}
                            </h3>
                            <div className='flex items-center mt-1 text-sm text-gray-400'>
                                <ArrowUpDown className='w-3.5 h-3.5 mr-1.5' />
                                {syncMethodDisplay}
                            </div>
                        </div>
                    </div>
                    <div className='flex flex-wrap gap-1 justify-end'>
                        {tags.map((tag, index) => (
                            <span
                                key={index}
                                className='px-2 py-0.5 text-xs font-medium rounded-full
                         bg-blue-500/20 text-blue-300 border border-blue-500/20'>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Sync Progress */}
                <div className='space-y-2'>
                    <div className='flex items-center justify-between text-sm'>
                        <span className='text-gray-400 flex items-center'>
                            <BarChart className='w-3.5 h-3.5 mr-1.5' />
                            Sync Progress
                        </span>
                        <span className='font-medium text-gray-300'>
                            {sync_percentage}%
                        </span>
                    </div>
                    <div className='w-full bg-gray-700/50 rounded-full h-1.5'>
                        <div
                            className='bg-blue-500 h-1.5 rounded-full transition-all duration-300'
                            style={{
                                width: `${Math.max(
                                    0,
                                    Math.min(100, sync_percentage)
                                )}%`
                            }}
                        />
                    </div>
                </div>

                {/* Sync Details */}
                <div className='grid grid-cols-2 gap-3 pt-2 border-t border-gray-700/50'>
                    <div className='text-sm'>
                        <div className='flex items-center text-gray-400 mb-1'>
                            <Clock className='w-3.5 h-3.5 mr-1.5' />
                            Last Sync
                        </div>
                        <div className='text-gray-300'>
                            {formatLastSync(last_sync_time)}
                        </div>
                    </div>

                    {/* Profiles Section */}
                    {data_to_sync?.profiles &&
                        data_to_sync.profiles.length > 0 && (
                            <div className='text-sm'>
                                <div className='text-gray-400 mb-1'>
                                    Profiles
                                </div>
                                <div className='flex flex-wrap gap-1'>
                                    {data_to_sync.profiles.map(
                                        (profile, index) => (
                                            <span
                                                key={index}
                                                className='px-1.5 py-0.5 text-xs rounded
                             bg-gray-700/50 text-gray-300'>
                                                {profile}
                                            </span>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
};

export default ArrCard;
