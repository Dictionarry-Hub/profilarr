import React from 'react';
import {Plus} from 'lucide-react';

const AddButton = ({onClick, label = 'Add New'}) => {
    return (
        <button
            onClick={onClick}
            className='flex items-center gap-2 px-3 py-2 rounded transition-colors bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            title={label}>
            <Plus className='w-4 h-4' />
            <span className='text-sm'>{label}</span>
        </button>
    );
};

export default AddButton;
