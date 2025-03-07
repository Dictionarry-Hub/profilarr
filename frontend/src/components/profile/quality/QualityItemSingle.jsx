import React from 'react';
import { Check, Info } from 'lucide-react';
import Tooltip from '@ui/Tooltip';
import RadarrLogo from '@logo/Radarr.svg';
import SonarrLogo from '@logo/Sonarr.svg';

const QualityItemSingle = ({
    quality,
    isDragging,
    listeners,
    attributes,
    style,
    onMouseEnter,
    onMouseLeave,
    willBeSelected
}) => {
    // Create tooltip content with just icons and text
    const AppTooltipContent = () => (
        <div className="flex items-center gap-3">
            {quality.radarr && (
                <div className="flex items-center text-white">
                    <img
                        src={RadarrLogo}
                        className="w-3.5 h-3.5 mr-1.5"
                        alt="Radarr"
                    />
                    <span className="text-xs">Radarr</span>
                </div>
            )}
            {quality.sonarr && (
                <div className="flex items-center text-white">
                    <img
                        src={SonarrLogo}
                        className="w-3.5 h-3.5 mr-1.5"
                        alt="Sonarr"
                    />
                    <span className="text-xs">Sonarr</span>
                </div>
            )}
        </div>
    );

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
            {/* Content Row */}
            <div className='flex items-center justify-between'>
                {/* Left Section with Title and Info */}
                <div className='flex-1 min-w-0'>
                    {/* Title Row */}
                    <div className='flex items-center flex-wrap'>
                        <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                            {quality.name}
                        </h3>
                    </div>
                    
                    {/* Description Row */}
                    {quality.description && (
                        <p className='mt-1.5 text-xs text-gray-600 dark:text-gray-400'>
                            {quality.description}
                        </p>
                    )}
                </div>

                {/* Right Section - Info Icon and Selection indicator */}
                <div className='flex items-center gap-2'>
                    {/* Info Badge with Tooltip */}
                    {(quality.radarr || quality.sonarr) && (
                        <Tooltip content={<AppTooltipContent />}>
                            <div className='flex items-center text-blue-500 dark:text-blue-400 cursor-help'>
                                <Info className='w-3.5 h-3.5' />
                            </div>
                        </Tooltip>
                    )}
                    
                    {/* Selection indicator */}
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

export default QualityItemSingle;