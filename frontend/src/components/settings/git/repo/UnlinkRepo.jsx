// UnlinkModal.js
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../../ui/Modal';
import { Unlink } from 'lucide-react';

const UnlinkRepo = ({ isOpen, onClose, onSubmit }) => {
  const [removeFiles, setRemoveFiles] = useState(false);

  const handleUnlink = () => {
    onSubmit(removeFiles); // Pass removeFiles correctly
    onClose(); // Close the modal after unlinking
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title='Unlink Repository' 
      width='md'
      footer={
        <div className='flex justify-end'>
          <button
            className='inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors text-sm font-medium'
            onClick={handleUnlink}
          >
            <Unlink className="w-4 h-4 text-red-500" />
            <span>Unlink</span>
          </button>
        </div>
      }>
      <div className='space-y-4'>
        <p className='text-sm text-gray-600 dark:text-gray-400'>
          This will disconnect your repository from Profilarr. You will need to re-link it to sync configuration files again.
        </p>
        
        <div className='bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4'>
          <label className='flex items-start space-x-3 cursor-pointer'>
            <input
              type='checkbox'
              id='removeFiles'
              checked={removeFiles}
              onChange={() => setRemoveFiles(!removeFiles)}
              className='mt-0.5 rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500 dark:bg-gray-700'
            />
            <div>
              <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                Delete local repository files
              </span>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                This will permanently remove all cloned repository files from your system. This action cannot be undone.
              </p>
            </div>
          </label>
        </div>
      </div>
    </Modal>
  );
};

UnlinkRepo.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default UnlinkRepo;