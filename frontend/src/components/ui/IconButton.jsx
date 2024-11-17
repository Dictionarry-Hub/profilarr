import React from 'react';
import {Loader} from 'lucide-react';
import Tooltip from './Tooltip';

const IconButton = ({
    onClick,
    disabled,
    loading,
    icon,
    tooltip,
    className,
    disabledTooltip
}) => {
    return (
        <Tooltip content={disabled ? disabledTooltip : tooltip}>
            <button
                onClick={onClick}
                disabled={disabled || loading}
                className={`flex items-center justify-center w-8 h-8 text-white rounded-md transition-all duration-200 ease-in-out hover:opacity-80 ${className} ${
                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}>
                {loading ? (
                    <Loader size={14} className='animate-spin' />
                ) : (
                    React.cloneElement(icon, {size: 14})
                )}
            </button>
        </Tooltip>
    );
};

export default IconButton;
