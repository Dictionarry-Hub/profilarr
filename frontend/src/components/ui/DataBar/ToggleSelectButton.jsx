import React from 'react';
import {CheckSquare} from 'lucide-react';

const ToggleSelectButton = ({
    isSelectionMode,
    onClick,
    shortcutKey = 'A' // Default to 'A' since that's what's used in the pages
}) => {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                isSelectionMode
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title={`Toggle selection mode (Ctrl+${shortcutKey})`}>
            <CheckSquare className='w-4 h-4' />
            <span className='text-sm'>Select</span>
        </button>
    );
};

export default ToggleSelectButton;
