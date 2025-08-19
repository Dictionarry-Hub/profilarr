import React from 'react';
import {Plus, Clock, ArrowUpDown, BarChart, Tag, Edit2, Trash2, Check, X} from 'lucide-react';
import RadarrLogo from '@logo/Radarr.svg';
import SonarrLogo from '@logo/Sonarr.svg';

const ArrTable = ({arrs, onAddArr, onEditArr, onDeleteArr}) => {
    const formatLastSync = timestamp => {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const getSyncMethodDisplay = (method, interval) => {
        switch (method) {
            case 'pull':
                return 'On Pull';
            case 'schedule':
                return `Every ${interval}m`;
            case 'manual':
                return 'Manual';
            default:
                return 'Unknown';
        }
    };

    return (
        <div className='rounded-lg border border-gray-700 overflow-hidden'>
            <table className='w-full'>
                <thead>
                    <tr className='bg-gray-800 border-b border-gray-700'>
                        <th className='py-3 px-6 text-left text-gray-400 font-medium w-8'>
                            Type
                        </th>
                        <th className='py-3 px-6 text-left text-gray-400 font-medium'>
                            Name
                        </th>
                        <th className='py-3 px-6 text-left text-gray-400 font-medium'>
                            <div className='flex items-center'>
                                <ArrowUpDown className='w-3.5 h-3.5 mr-1.5' />
                                Sync Method
                            </div>
                        </th>
                        <th className='py-3 px-6 text-left text-gray-400 font-medium'>
                            <div className='flex items-center'>
                                <BarChart className='w-3.5 h-3.5 mr-1.5' />
                                Progress
                            </div>
                        </th>
                        <th className='py-3 px-6 text-left text-gray-400 font-medium'>
                            <div className='flex items-center'>
                                <Clock className='w-3.5 h-3.5 mr-1.5' />
                                Last Sync
                            </div>
                        </th>
                        <th className='py-3 px-6 text-left text-gray-400 font-medium'>
                            <div className='flex items-center'>
                                <Tag className='w-3.5 h-3.5 mr-1.5' />
                                Tags
                            </div>
                        </th>
                        <th className='py-3 px-6 text-left text-gray-400 font-medium'>
                            Sync Data
                        </th>
                        <th className='py-3 px-6 text-center text-gray-400 font-medium'>
                            Unique
                        </th>
                        <th className='py-3 px-6 text-right text-gray-400 font-medium'>
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {arrs.map((arr, index) => (
                        <tr
                            key={arr.id}
                            className='border-b border-gray-700 hover:bg-gray-800/50 transition-colors cursor-pointer'
                            onClick={() => onEditArr(arr)}>
                            <td className='py-4 px-6'>
                                <img
                                    src={arr.type === 'radarr' ? RadarrLogo : SonarrLogo}
                                    className='w-5 h-5'
                                    alt={arr.type === 'radarr' ? 'Radarr' : 'Sonarr'}
                                />
                            </td>
                            <td className='py-4 px-6'>
                                <span className='text-gray-100 font-medium'>{arr.name}</span>
                            </td>
                            <td className='py-4 px-6'>
                                <span className='text-gray-300 text-sm'>
                                    {getSyncMethodDisplay(arr.sync_method, arr.sync_interval)}
                                </span>
                            </td>
                            <td className='py-4 px-6'>
                                {arr.sync_method === 'manual' ? (
                                    <span className='text-gray-500 text-sm'>N/A</span>
                                ) : (
                                    <div className='flex items-center space-x-2'>
                                        <div className='w-24 bg-gray-700/50 rounded-full h-1.5'>
                                            <div
                                                className='bg-blue-500 h-1.5 rounded-full transition-all duration-300'
                                                style={{
                                                    width: `${Math.max(
                                                        0,
                                                        Math.min(100, arr.sync_percentage || 0)
                                                    )}%`
                                                }}
                                            />
                                        </div>
                                        <span className='text-gray-400 text-sm'>
                                            {arr.sync_percentage || 0}%
                                        </span>
                                    </div>
                                )}
                            </td>
                            <td className='py-4 px-6'>
                                <span className='text-gray-300 text-sm'>
                                    {arr.sync_method === 'manual' ? 'Manual' : formatLastSync(arr.last_sync_time)}
                                </span>
                            </td>
                            <td className='py-4 px-6'>
                                <div className='flex flex-wrap gap-1'>
                                    {arr.tags && arr.tags.length > 0 ? (
                                        arr.tags.map((tag, tagIndex) => (
                                            <span
                                                key={tagIndex}
                                                className='px-2 py-0.5 text-xs font-medium rounded-full
                                                     bg-blue-500/20 text-blue-300 border border-blue-500/20'>
                                                {tag}
                                            </span>
                                        ))
                                    ) : (
                                        <span className='text-gray-500 text-sm'>None</span>
                                    )}
                                </div>
                            </td>
                            <td className='py-4 px-6'>
                                <div className='text-sm text-gray-300'>
                                    {arr.data_to_sync?.profiles && arr.data_to_sync.profiles.length > 0 && 
                                     arr.data_to_sync?.customFormats && arr.data_to_sync.customFormats.length > 0 ? (
                                        <span>{arr.data_to_sync.profiles.length} profiles, {arr.data_to_sync.customFormats.length} formats</span>
                                    ) : arr.data_to_sync?.profiles && arr.data_to_sync.profiles.length > 0 ? (
                                        <span>{arr.data_to_sync.profiles.length} profile{arr.data_to_sync.profiles.length !== 1 ? 's' : ''}</span>
                                    ) : arr.data_to_sync?.customFormats && arr.data_to_sync.customFormats.length > 0 ? (
                                        <span>{arr.data_to_sync.customFormats.length} format{arr.data_to_sync.customFormats.length !== 1 ? 's' : ''}</span>
                                    ) : (
                                        <span className='text-gray-500'>None</span>
                                    )}
                                </div>
                            </td>
                            <td className='py-4 px-6 text-center'>
                                {arr.import_as_unique ? (
                                    <Check className='w-4 h-4 text-green-500 inline-block' />
                                ) : (
                                    <X className='w-4 h-4 text-gray-500 inline-block' />
                                )}
                            </td>
                            <td className='py-4 px-6'>
                                <div className='flex items-center justify-end space-x-2'>
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            onEditArr(arr);
                                        }}
                                        className='p-1.5 hover:bg-gray-700 rounded transition-colors'>
                                        <Edit2 className='w-4 h-4 text-gray-400 hover:text-blue-400' />
                                    </button>
                                    {onDeleteArr && (
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                onDeleteArr(arr.id);
                                            }}
                                            className='p-1.5 hover:bg-gray-700 rounded transition-colors'>
                                            <Trash2 className='w-4 h-4 text-gray-400 hover:text-red-400' />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    <tr
                        className='hover:bg-gray-800/50 transition-colors cursor-pointer'
                        onClick={onAddArr}>
                        <td colSpan='9' className='py-5 text-center'>
                            <div className='flex items-center justify-center space-x-2 text-gray-400 hover:text-blue-400 transition-colors'>
                                <Plus className='w-5 h-5' />
                                <span className='font-medium'>Add New App</span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default ArrTable;