// UnlinkModal.js
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../ui/Modal';

const UnlinkRepoModal = ({ isOpen, onClose, onSubmit }) => {
  const [removeFiles, setRemoveFiles] = useState(false);

  const handleUnlink = () => {
    onSubmit(removeFiles); // Pass removeFiles correctly
    onClose(); // Close the modal after unlinking
};

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Unlink Repository">
      <div className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300">
          Are you sure you want to unlink the repository?
        </p>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="removeFiles"
            checked={removeFiles}
            onChange={() => setRemoveFiles(!removeFiles)}
            className="form-checkbox h-4 w-4 text-red-600 transition duration-150 ease-in-out"
          />
          <label htmlFor="removeFiles" className="ml-2 text-gray-700 dark:text-gray-300">
            Also remove repository files
          </label>
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <button
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors duration-200 ease-in-out text-xs"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 ease-in-out text-xs"
            onClick={handleUnlink}
          >
            Unlink
          </button>
        </div>
      </div>
    </Modal>
  );
};

UnlinkRepoModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default UnlinkRepoModal;
