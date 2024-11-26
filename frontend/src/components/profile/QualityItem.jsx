import React from 'react';
import RadarrLogo from '@logo/Radarr.svg';
import SonarrLogo from '@logo/Sonarr.svg';
import {Pencil, Trash2} from 'lucide-react';

const QualityItem = ({
    quality,
    isDragging,
    listeners,
    attributes,
    style,
    onDelete,
    onEdit
}) => {
    const isGroup = 'qualities' in quality;

    return (
        <div
            className={`
                relative p-2.5 rounded-lg select-none cursor-grab active:cursor-grabbing
                border ${
                    quality.enabled
                        ? 'border-blue-200 dark:border-blue-800'
                        : 'border-gray-200 dark:border-gray-700'
                }
                transition-colors duration-200
                ${
                    quality.enabled
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'bg-white dark:bg-gray-800'
                }
                hover:border-blue-500 dark:hover:border-blue-400
                ${isDragging ? 'opacity-50' : ''}
                group
            `}
            style={style}
            {...attributes}
            {...listeners}>
            {/* Header Section */}
            <div className='flex items-start justify-between gap-3'>
                {/* Title and Description */}
                <div className='flex-1 min-w-0'>
                    <h3 className='text-xs font-medium text-gray-900 dark:text-gray-100'>
                        {quality.name}
                    </h3>
                    {isGroup && quality.description && (
                        <p className='mt-0.5 text-xs text-gray-500 dark:text-gray-400'>
                            {quality.description}
                        </p>
                    )}
                </div>

                {/* Actions and Icons */}
                <div className='flex items-center gap-2'>
                    {/* App Icons */}
                    <div className='flex items-center gap-1.5'>
                        {quality.radarr && (
                            <img
                                src={RadarrLogo}
                                className='w-3.5 h-3.5'
                                alt='Radarr'
                            />
                        )}
                        {quality.sonarr && (
                            <img
                                src={SonarrLogo}
                                className='w-3.5 h-3.5'
                                alt='Sonarr'
                            />
                        )}
                    </div>

                    {/* Edit/Delete Actions */}
                    {isGroup && (
                        <div className='flex items-center gap-1 ml-1'>
                            {onEdit && (
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        onEdit(quality);
                                    }}
                                    className='hidden group-hover:flex items-center justify-center h-6 w-6 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-all'>
                                    <Pencil className='w-3 h-3' />
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        onDelete(quality);
                                    }}
                                    className='hidden group-hover:flex items-center justify-center h-6 w-6 rounded-md text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-all'>
                                    <Trash2 className='w-3 h-3' />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Quality Tags Section */}
            {isGroup && (
                <div className='mt-2 flex flex-wrap items-center gap-1'>
                    {quality.qualities.map(q => (
                        <span
                            key={q.id}
                            className='inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
                            {q.name}
                        </span>
                    ))}
                </div>
            )}

            {/* Non-group Description */}
            {!isGroup && quality.description && (
                <p className='mt-0.5 text-xs text-gray-500 dark:text-gray-400'>
                    {quality.description}
                </p>
            )}
        </div>
    );
};

export default QualityItem;
