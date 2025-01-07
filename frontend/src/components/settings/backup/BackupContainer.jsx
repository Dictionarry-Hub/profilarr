import React, {useState, useEffect} from 'react';
import {
    listBackups,
    createBackup,
    restoreBackup,
    deleteBackup,
    importBackup,
    downloadBackup
} from '@api/backup';
import Alert from '@ui/Alert';
import {Loader, Upload, RefreshCw} from 'lucide-react';
import BackupCard from './BackupCard';

const BackupContainer = () => {
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [restoringBackup, setRestoringBackup] = useState(null);
    const [deletingBackup, setDeletingBackup] = useState(null);

    useEffect(() => {
        fetchBackups();
    }, []);

    const fetchBackups = async () => {
        setLoading(true);
        try {
            const fetchedBackups = await listBackups();
            setBackups(fetchedBackups);
        } catch (error) {
            Alert.error('Failed to fetch backups');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBackup = async () => {
        try {
            await createBackup();
            Alert.success('Backup created successfully');
            fetchBackups();
        } catch (error) {
            Alert.error('Failed to create backup');
        }
    };

    const handleRestoreBackup = async filename => {
        if (
            window.confirm(
                'Are you sure you want to restore this backup? This will overwrite your current configuration.'
            )
        ) {
            setRestoringBackup(filename);
            try {
                await restoreBackup(filename);
                Alert.success('Backup restored successfully');
                fetchBackups();
            } catch (error) {
                Alert.error('Failed to restore backup');
            } finally {
                setRestoringBackup(null);
            }
        }
    };

    const handleDeleteBackup = async filename => {
        if (window.confirm('Are you sure you want to delete this backup?')) {
            setDeletingBackup(filename);
            try {
                await deleteBackup(filename);
                Alert.success('Backup deleted successfully');
                fetchBackups();
            } catch (error) {
                Alert.error('Failed to delete backup');
            } finally {
                setDeletingBackup(null);
            }
        }
    };

    const handleImportBackup = async event => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            await importBackup(file);
            Alert.success('Backup imported and restored successfully');
            fetchBackups();
        } catch (error) {
            Alert.error('Failed to import and restore backup');
        }
    };

    const handleDownloadBackup = async filename => {
        try {
            const response = await downloadBackup(filename);
            const url = window.URL.createObjectURL(response);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            Alert.error('Failed to download backup');
        }
    };

    if (loading) {
        return (
            <div className='flex items-center justify-center p-8'>
                <Loader className='animate-spin' size={24} />
            </div>
        );
    }

    return (
        <div className='space-y-4'>
            <div className='flex justify-between items-center'>
                <h2 className='text-xl font-bold text-gray-100'>
                    Backup Management
                </h2>
                <div className='space-x-4'>
                    <button
                        onClick={handleCreateBackup}
                        className='px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition duration-200'>
                        <RefreshCw className='inline-block mr-2' size={16} />
                        Create Backup
                    </button>
                    <label
                        htmlFor='backupFile'
                        className='px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition duration-200 cursor-pointer'>
                        <Upload className='inline-block mr-2' size={16} />
                        Restore From Zip
                        <input
                            type='file'
                            id='backupFile'
                            onChange={handleImportBackup}
                            accept='.zip'
                            className='hidden'
                        />
                    </label>
                </div>
            </div>
            <div className='overflow-x-auto rounded-lg border border-gray-700'>
                <table className='min-w-full'>
                    <thead className='bg-gray-800 border-b border-gray-700'>
                        <tr>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium bg-gray-800'>
                                Name
                            </th>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium bg-gray-800'>
                                Date/Time
                            </th>
                            <th className='py-3 px-4 text-left text-gray-400 font-medium bg-gray-800'>
                                Size
                            </th>
                            <th className='py-3 px-4 text-right text-gray-400 font-medium bg-gray-800'>
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {backups.length === 0 ? (
                            <tr>
                                <td
                                    colSpan='4'
                                    className='text-center py-4 text-gray-300'>
                                    No backups available
                                </td>
                            </tr>
                        ) : (
                            backups.map(backup => (
                                <BackupCard
                                    key={backup.filename}
                                    backup={backup}
                                    onRestore={handleRestoreBackup}
                                    onDelete={handleDeleteBackup}
                                    onDownload={handleDownloadBackup}
                                    isRestoring={
                                        restoringBackup === backup.filename
                                    }
                                    isDeleting={
                                        deletingBackup === backup.filename
                                    }
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BackupContainer;
