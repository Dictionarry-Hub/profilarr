import React from 'react';
import {Plus} from 'lucide-react';

const AddButton = ({onClick, label = 'Add New'}) => {
    return (
        <button
            onClick={onClick}
            className='flex items-center gap-2 px-3 py-2 min-h-10 rounded-md
        border border-gray-200 dark:border-gray-700
        bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 
        hover:bg-gray-50 dark:hover:bg-gray-750
        hover:border-blue-500/50 hover:text-blue-500
        dark:hover:border-blue-500/50 dark:hover:text-blue-400
        transition-all duration-150 ease-in-out
        group'
            title={label}>
            <Plus
                className='w-4 h-4 transition-transform duration-200 ease-out
        group-hover:rotate-90 group-hover:scale-110 
        group-hover:text-blue-500 dark:group-hover:text-blue-400'
            />
            <span className='text-sm font-medium hidden sm:inline'>{label}</span>
        </button>
    );
};

export default AddButton;
