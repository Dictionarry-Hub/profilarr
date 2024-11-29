// DeleteConfirmationModal.jsx
import React from 'react';
import PropTypes from 'prop-types';
import Modal from '@ui/Modal';
import {AlertTriangle} from 'lucide-react';

const DeleteConfirmationModal = ({isOpen, onClose, onConfirm}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title='Delete Test'
            width='sm'
            footer={
                <div className='flex justify-end space-x-3'>
                    <button
                        onClick={onClose}
                        className='px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 
                        bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md 
                        hover:bg-gray-50 dark:hover:bg-gray-700'>
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className='px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md 
                        hover:bg-red-700'>
                        Delete
                    </button>
                </div>
            }>
            <div className='flex items-center gap-3 text-gray-700 dark:text-gray-200'>
                <AlertTriangle className='w-5 h-5 text-red-500' />
                <p>
                    Are you sure you want to delete this test case? This action
                    cannot be undone.
                </p>
            </div>
        </Modal>
    );
};

DeleteConfirmationModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired
};

export default DeleteConfirmationModal;
