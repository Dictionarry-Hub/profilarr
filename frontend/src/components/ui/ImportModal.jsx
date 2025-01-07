import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import Modal from './Modal';
import {getArrConfigs} from '@api/arr';

const ImportModal = ({isOpen, onClose, onImport, type}) => {
    const [selectedArr, setSelectedArr] = useState('');
    const [error, setError] = useState('');
    const [arrs, setArrs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        // Fetch available arrs when modal opens
        if (isOpen) {
            fetchArrs();
        }
    }, [isOpen]);

    const fetchArrs = async () => {
        try {
            const response = await getArrConfigs();
            if (response.success) {
                setArrs(response.data || []);
            } else {
                setError('Failed to load arr instances');
            }
        } catch (err) {
            setError('Failed to load arr instances');
            console.error('Error fetching arrs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        if (!selectedArr) {
            setError('Please select an arr to import to');
            return;
        }

        setIsImporting(true);
        try {
            await onImport(selectedArr);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to import');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Import ${type}`}
            footer={
                <div className='flex justify-end gap-2'>
                    <button
                        onClick={onClose}
                        className='px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors'>
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!selectedArr || isLoading || isImporting}
                        className='px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-700 text-white rounded transition-colors'>
                        {isImporting ? 'Importing...' : 'Import'}
                    </button>
                </div>
            }>
            <div className='space-y-4'>
                <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                        Select Arr
                    </label>
                    {isLoading ? (
                        <div className='animate-pulse bg-gray-200 dark:bg-gray-700 h-10 rounded'></div>
                    ) : arrs.length > 0 ? (
                        <select
                            value={selectedArr}
                            onChange={e => {
                                setSelectedArr(e.target.value);
                                setError('');
                            }}
                            className='w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500'>
                            <option value=''>Select an arr...</option>
                            {arrs.map(arr => (
                                <option key={arr.id} value={arr.id}>
                                    {arr.name} ({arr.type})
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className='text-sm text-red-500'>
                            No arr instances configured. Please add one in
                            settings.
                        </div>
                    )}
                </div>

                {error && <p className='text-sm text-red-500'>{error}</p>}
            </div>
        </Modal>
    );
};

ImportModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onImport: PropTypes.func.isRequired,
    type: PropTypes.string.isRequired
};

export default ImportModal;
