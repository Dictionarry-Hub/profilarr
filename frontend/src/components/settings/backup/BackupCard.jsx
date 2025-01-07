import React from 'react';
import {Loader, Download, Trash2, RefreshCw} from 'lucide-react';

const BackupCard = ({
    backup,
    onRestore,
    onDelete,
    onDownload,
    isRestoring,
    isDeleting
}) => {
    const formatDateTime = dateString => new Date(dateString).toLocaleString();

    const formatSize = size =>
        size ? `${(size / 1024 / 1024).toFixed(2)} MB` : 'N/A';

    return (
        <tr className='bg-gray-900 border-b border-gray-700'>
            <td className='py-4 px-4'>
                <div className='flex items-center space-x-3'>
                    <span className='font-medium text-gray-100'>
                        {backup.filename}
                    </span>
                </div>
            </td>
            <td className='py-4 px-4 text-gray-300'>
                {formatDateTime(backup.created_at)}
            </td>
            <td className='py-4 px-4 text-gray-300'>
                {formatSize(backup.size)}
            </td>
            <td className='py-4 px-4 flex justify-end space-x-2'>
                <div className='group relative'>
                    <button
                        onClick={() => onRestore(backup.filename)}
                        disabled={isRestoring}
                        className='p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition-colors'>
                        {isRestoring ? (
                            <Loader className='animate-spin' size={16} />
                        ) : (
                            <RefreshCw size={16} />
                        )}
                    </button>
                    <span className='absolute hidden group-hover:block bg-gray-700 text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2'>
                        Restore Backup
                    </span>
                </div>
                <div className='group relative'>
                    <button
                        onClick={() => onDownload(backup.filename)}
                        className='p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors'>
                        <Download size={16} />
                    </button>
                    <span className='absolute hidden group-hover:block bg-gray-700 text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2'>
                        Download Backup
                    </span>
                </div>
                <div className='group relative'>
                    <button
                        onClick={() => onDelete(backup.filename)}
                        disabled={isDeleting}
                        className='p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition-colors'>
                        {isDeleting ? (
                            <Loader className='animate-spin' size={16} />
                        ) : (
                            <Trash2 size={16} />
                        )}
                    </button>
                    <span className='absolute hidden group-hover:block bg-gray-700 text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2'>
                        Delete Backup
                    </span>
                </div>
            </td>
        </tr>
    );
};

export default BackupCard;
