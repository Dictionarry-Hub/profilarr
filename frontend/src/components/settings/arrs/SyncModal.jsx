// SyncModal.jsx
import React from 'react';
import PropTypes from 'prop-types';
import {Loader} from 'lucide-react';
import Modal from '@ui/Modal';

const SyncModal = ({isOpen, onClose, onSync, onSkip, isSyncing}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title='Run Initial Sync'
            width='md'
            footer={
                <div className='flex justify-end space-x-3'>
                    <button
                        type='button'
                        onClick={onSkip}
                        disabled={isSyncing}
                        className='px-3 py-2 text-sm rounded-lg bg-gray-200 hover:bg-gray-300 
                                 dark:bg-gray-700 dark:hover:bg-gray-600 
                                 text-gray-700 dark:text-gray-200 font-medium transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed'>
                        Skip
                    </button>
                    <button
                        type='button'
                        onClick={onSync}
                        disabled={isSyncing}
                        className='flex items-center px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-white font-medium transition-colors'>
                        {isSyncing ? (
                            <>
                                <Loader className='w-3.5 h-3.5 mr-2 animate-spin' />
                                Syncing...
                            </>
                        ) : (
                            'Start Sync'
                        )}
                    </button>
                </div>
            }>
            <p className='text-gray-700 dark:text-gray-300'>
                Would you like to run an initial sync now to get started?
            </p>
        </Modal>
    );
};

SyncModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSync: PropTypes.func.isRequired,
    onSkip: PropTypes.func.isRequired,
    isSyncing: PropTypes.bool.isRequired
};

export default SyncModal;
