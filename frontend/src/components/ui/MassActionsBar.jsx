import React from 'react';
import PropTypes from 'prop-types';
import {X, Trash2, FolderUp} from 'lucide-react';

const MassActionsBar = ({
    selectedCount,
    onCancel,
    onDelete,
    onImport,
    showImport = true
}) => {
    return (
        <div className='fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-4 py-2 flex items-center gap-4 border border-gray-200 dark:border-gray-700 animate-fade-in'>
            <span className='text-sm text-gray-600 dark:text-gray-300'>
                {selectedCount} items selected
            </span>

            <div className='flex items-center gap-2'>
                {showImport && (
                    <button
                        onClick={onImport}
                        className='flex items-center gap-2 px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors'>
                        <FolderUp className='w-4 h-4' />
                        Import
                    </button>
                )}

                <button
                    onClick={onDelete}
                    className='flex items-center gap-2 px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors'>
                    <Trash2 className='w-4 h-4' />
                    Delete
                </button>

                <button
                    onClick={onCancel}
                    className='flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors'>
                    <X className='w-4 h-4' />
                    Cancel
                </button>
            </div>
        </div>
    );
};

MassActionsBar.propTypes = {
    selectedCount: PropTypes.number.isRequired,
    onCancel: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    onImport: PropTypes.func.isRequired,
    showImport: PropTypes.bool
};

export default MassActionsBar;
