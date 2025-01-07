import React from 'react';
import {Plus} from 'lucide-react';

const AddButton = ({onClick, label = 'Add New', top, right, bottom, left}) => {
    const positionStyle = {
        position: 'fixed',
        zIndex: 50,
        ...(top !== undefined && {
            top: typeof top === 'number' ? `${top}px` : top
        }),
        ...(right !== undefined && {
            right: typeof right === 'number' ? `${right}px` : right
        }),
        ...(bottom !== undefined && {
            bottom: typeof bottom === 'number' ? `${bottom}px` : bottom
        }),
        ...(left !== undefined && {
            left: typeof left === 'number' ? `${left}px` : left
        })
    };

    return (
        <div style={positionStyle}>
            <div
                onClick={onClick}
                className='add-button-container flex items-center bg-gradient-to-br from-gray-800 to-gray-900 
                    rounded-full border border-gray-700 shadow-xl hover:shadow-2xl 
                    hover:border-blue-500/50 transition-all duration-300 cursor-pointer overflow-hidden'>
                <div className='p-4 bg-blue-500/10 hover:bg-blue-500/20 transition-colors rounded-full'>
                    <Plus className='w-6 h-6 text-blue-400' />
                </div>
                <div className='add-button-label-wrapper'>
                    <span className='add-button-label font-medium text-gray-100 pl-5 pr-1 text-lg whitespace-nowrap'>
                        {label}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AddButton;
