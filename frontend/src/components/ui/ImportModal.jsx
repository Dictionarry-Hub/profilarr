import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import {Loader, Check, Upload} from 'lucide-react';
import Modal from './Modal';
import {getArrConfigs} from '@api/arr';

const ImportModal = ({isOpen, onClose, onImport, type}) => {
    const [selectedArr, setSelectedArr] = useState('');
    const [error, setError] = useState('');
    const [arrs, setArrs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);

    useEffect(() => {
        // Reset state when modal opens and fetch arr instances
        if (isOpen) {
            setSelectedArr('');
            setError('');
            setIsImporting(false);
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
            width='xl'
            footer={
                <div className='flex justify-end'>
                    <button
                        onClick={handleImport}
                        disabled={!selectedArr || isLoading || isImporting}
                        className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-700/50 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm'
                    >
                        {isImporting ? (
                            <>
                                <Check className='w-4 h-4 text-green-500' />
                                <span>Importing...</span>
                            </>
                        ) : (
                            <>
                                <Upload className='w-4 h-4 text-blue-500' />
                                <span>Import</span>
                            </>
                        )}
                    </button>
                </div>
            }>
            {isLoading ? (
                <div className='flex items-center justify-center py-8'>
                    <Loader className='w-6 h-6 animate-spin text-blue-500' />
                    <span className='ml-2'>Loading...</span>
                </div>
            ) : arrs.length === 0 ? (
                <div className='text-center py-8'>
                    <p className='text-gray-600'>No arr instances configured</p>
                </div>
            ) : (
                <div className='bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 overflow-hidden'>
                    <table className='w-full'>
                        <thead>
                            <tr className='bg-gray-800/50 border-b border-gray-700'>
                                <th className='text-left py-3 px-4 text-sm font-medium text-gray-300'>Name</th>
                                <th className='text-left py-3 px-4 text-sm font-medium text-gray-300'>Type</th>
                                <th className='text-right py-3 px-4 text-sm font-medium text-gray-300'>Select</th>
                            </tr>
                        </thead>
                        <tbody>
                            {arrs.map((arr, index) => (
                                <tr
                                    key={arr.id}
                                    className={`cursor-pointer select-none transition-colors hover:bg-gray-700/50 ${index !== arrs.length - 1 ? 'border-b border-gray-700/50' : ''}`}
                                    onClick={() => setSelectedArr(arr.id)}
                                >
                                    <td className='py-3 px-4'>
                                        <span className='font-medium text-gray-200'>{arr.name}</span>
                                    </td>
                                    <td className='py-3 px-4'>
                                        <span className='text-sm text-gray-400'>{arr.type}</span>
                                    </td>
                                    <td className='py-3 px-4'>
                                        <div className='flex justify-end'>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                                                selectedArr === arr.id
                                                    ? 'bg-blue-500'
                                                    : 'bg-gray-700 hover:bg-gray-600'
                                            }`}>
                                                {selectedArr === arr.id && (
                                                    <Check size={14} className='text-white' />
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {error && <p className='text-sm text-red-500 mt-4'>{error}</p>}
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
