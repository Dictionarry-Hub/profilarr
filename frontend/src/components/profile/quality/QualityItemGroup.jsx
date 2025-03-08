import React from 'react';
import RadarrLogo from '@logo/Radarr.svg';
import SonarrLogo from '@logo/Sonarr.svg';
import {Pencil, Trash2, Check, ArrowUp} from 'lucide-react';
import Tooltip from '@ui/Tooltip';

const QualityItemGroup = ({
    quality,
    isDragging,
    listeners,
    attributes,
    style,
    onDelete,
    onEdit,
    onMouseEnter,
    onMouseLeave,
    willBeSelected,
    isUpgradeUntil,
    onUpgradeUntilClick
}) => {
    const handleUpgradeClick = e => {
        e.stopPropagation();
        onUpgradeUntilClick?.(quality);
    };

    return (
        <div
            className={`
                relative p-2.5 rounded-lg select-none cursor-grab active:cursor-grabbing
                border border-gray-200 dark:border-gray-700
                transition-colors duration-200
                bg-white dark:bg-gray-800
                hover:border-gray-300 dark:hover:border-gray-600
                ${isDragging ? 'opacity-50' : ''}
                group
            `}
            style={style}
            {...attributes}
            {...listeners}
            onMouseEnter={() => onMouseEnter?.(quality.id)}
            onMouseLeave={onMouseLeave}>
            {/* Header Row */}
            <div className='flex items-center justify-between'>
                {/* Title and Description */}
                <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-3 flex-wrap'>
                        <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                            {quality.name}
                        </h3>

                        {/* Quality tags inline with name */}
                        <div className='flex flex-wrap items-center gap-1.5'>
                            {quality.qualities.map(q => (
                                <span
                                    key={q.id}
                                    className='inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'>
                                    {q.name}
                                </span>
                            ))}
                        </div>
                    </div>
                    {quality.description && (
                        <p className='mt-1.5 text-xs text-gray-600 dark:text-gray-400'>
                            {quality.description}
                        </p>
                    )}
                </div>

                {/* Right Section */}
                <div className='flex items-center gap-2'>
                    {/* App Icons */}
                    <div className='flex items-center gap-1.5'>
                        {quality.radarr && (
                            <div className='flex items-center bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded px-1.5 py-0.5'>
                                <img
                                    src={RadarrLogo}
                                    className='w-3 h-3 mr-1'
                                    alt='Radarr'
                                />
                                <span className='text-[10px] font-medium'>
                                    Radarr
                                </span>
                            </div>
                        )}
                        {quality.sonarr && (
                            <div className='flex items-center bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded px-1.5 py-0.5'>
                                <img
                                    src={SonarrLogo}
                                    className='w-3 h-3 mr-1'
                                    alt='Sonarr'
                                />
                                <span className='text-[10px] font-medium'>
                                    Sonarr
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Edit/Delete Actions */}
                    <div className='flex items-center gap-2'>
                        {onEdit && (
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    onEdit(quality);
                                }}
                                className='flex items-center justify-center h-6 w-6 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600 transition-colors'>
                                <Pencil className='w-3 h-3' />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    onDelete(quality);
                                }}
                                className='flex items-center justify-center h-6 w-6 rounded text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 border border-red-200 hover:border-red-300 dark:border-red-800/40 dark:hover:border-red-700/40 transition-colors'>
                                <Trash2 className='w-3 h-3' />
                            </button>
                        )}
                    </div>

                    {/* Upgrade Until button - only shown when enabled and upgrade is allowed */}
                    {quality.enabled && onUpgradeUntilClick && (
                        <Tooltip
                            content={
                                isUpgradeUntil
                                    ? 'This quality is set as upgrade until'
                                    : 'Set as upgrade until quality'
                            }>
                            <button
                                onClick={handleUpgradeClick}
                                className={`
                                    w-5 h-5 rounded-full flex items-center justify-center
                                    ${
                                        isUpgradeUntil
                                            ? 'bg-green-500 dark:bg-green-600 text-white'
                                            : 'border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10'
                                    }
                                `}>
                                <ArrowUp size={12} />
                            </button>
                        </Tooltip>
                    )}

                    {/* Selected indicator - shows all three states */}
                    <div
                        className={`
                        w-5 h-5 rounded-full flex items-center justify-center
                        ${
                            quality.enabled
                                ? 'bg-blue-500 dark:bg-blue-600'
                                : 'border border-gray-300 dark:border-gray-600'
                        }
                        ${
                            !quality.enabled && willBeSelected
                                ? 'bg-blue-100 dark:bg-blue-900/30'
                                : ''
                        }
                    `}>
                        {quality.enabled && (
                            <Check size={14} className='text-white' />
                        )}
                        {willBeSelected && !quality.enabled && (
                            <div className='w-2 h-2 rounded-full bg-blue-400' />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QualityItemGroup;
