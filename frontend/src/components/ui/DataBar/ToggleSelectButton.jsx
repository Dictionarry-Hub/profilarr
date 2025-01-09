import React from 'react';
import {CheckSquare} from 'lucide-react';

const ToggleSelectButton = ({isSelectionMode, onClick, shortcutKey = 'A'}) => {
    return (
        <button
            onClick={onClick}
            className={`
        flex items-center gap-2 px-3 py-2 rounded-md
        border border-gray-200 dark:border-gray-700
        transition-all duration-150 ease-in-out
        group
        ${
            isSelectionMode
                ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-blue-500/50 hover:text-blue-500 dark:hover:border-blue-500/50 dark:hover:text-blue-400'
        }
      `}
            title={`Toggle selection mode (Ctrl+${shortcutKey})`}>
            <CheckSquare
                className={`w-4 h-4 transition-all duration-200
        ${
            isSelectionMode
                ? ''
                : 'group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:animate-[check-bounce_0.3s_ease-in-out]'
        }
      `}
            />
            <span className='text-sm font-medium'>Select</span>
        </button>
    );
};

export default ToggleSelectButton;
