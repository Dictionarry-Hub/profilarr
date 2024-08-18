import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { getBranches, checkoutBranch, createBranch, deleteBranch } from '../../api/api';
import { ExternalLink, Trash2, GitBranchPlus, ArrowRightCircle, Loader } from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import Alert from '../ui/Alert';

const SettingsBranchModal = ({ isOpen, onClose, repoUrl, currentBranch, onBranchChange }) => {
  const [branches, setBranches] = useState([]);
  const [branchOffMode, setBranchOffMode] = useState(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [validBranchName, setValidBranchName] = useState(true);
  const [branchToDelete, setBranchToDelete] = useState(null);
  const [loadingAction, setLoadingAction] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchBranches();
      resetForm();
    }
  }, [isOpen]);

  const fetchBranches = async () => {
    try {
      const response = await getBranches();
      if (response.success && response.data.branches) {
        setBranches(response.data.branches);
      } else {
        console.error('Error fetching branches:', response.data.error);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const resetForm = () => {
    setBranchOffMode(null);
    setNewBranchName('');
    setValidBranchName(true);
    setBranchToDelete(null);
    setLoadingAction('');
  };

  const handleCheckout = async (branchName, isNewBranch = false) => {
    setLoadingAction(`checkout-${branchName}`);
    try {
      const response = await checkoutBranch(branchName);
      if (response.success) {
        // Refresh branches after successful checkout
        await fetchBranches();
        // Notify parent component to update the status
        onBranchChange();  // <-- Call the callback to update status in the parent component
        if (!isNewBranch) {
          Alert.success('Branch checked out successfully');
        }
        onClose(); // Close the modal
      } else {
        Alert.error(response.error); // Use the Alert component for error
      }
    } catch (error) {
      if (error.response && error.response.status === 400 && error.response.data.error) {
        Alert.error(error.response.data.error); // Show alert with specific backend error message
      } else {
        Alert.error('An unexpected error occurred while checking out the branch.');
        console.error('Error checking out branch:', error);
      }
    } finally {
      setLoadingAction('');
    }
  };

  const handleBranchOff = async () => {
    setLoadingAction('branchOff');
    if (newBranchName && validBranchName) {
      try {
        const response = await createBranch(newBranchName, branchOffMode);
        if (response.success) {
          // Checkout the new branch without showing the checkout alert
          await handleCheckout(newBranchName, true);
          Alert.success('Branch created and checked out successfully');
        } else {
          Alert.error(response.error); // Handle known errors from the backend
        }
      } catch (error) {
        if (error.response && error.response.status === 400 && error.response.data.error) {
          Alert.error(error.response.data.error); // Specific error from the backend
        } else {
          console.error('Error branching off:', error); // Log unexpected errors
          Alert.error('An unexpected error occurred while creating the branch. Please try again.');
        }
      } finally {
        setLoadingAction('');
      }
    } else {
      Alert.error('Please enter a valid branch name.');
    }
  };

  const handleBranchOffClick = (branchName) => {
    setBranchOffMode(branchName);
    setNewBranchName('');
    setValidBranchName(true);
  };

  const validateBranchName = (name) => {
    const isValid = /^[a-zA-Z0-9._-]+$/.test(name);
    setValidBranchName(isValid);
    setNewBranchName(name);
  };

  const handleOpenInGitHub = (branchName) => {
    const branchUrl = `${repoUrl}/tree/${encodeURIComponent(branchName)}`;
    window.open(branchUrl, '_blank');
  };

  const confirmDeleteBranch = (branchName) => {
    setBranchToDelete(branchName);
  };

  const handleDeleteBranch = async () => {
    if (branchToDelete && branchToDelete.toLowerCase() === 'main') {
      Alert.warning("The 'main' branch cannot be deleted.");
      return;
    }
    setLoadingAction(`delete-${branchToDelete}`);
    try {
      const response = await deleteBranch(branchToDelete);
      if (response.success) {
        onBranchChange();  // <-- Call the callback to update status in the parent component
        await fetchBranches(); // Refresh the list after deletion
        Alert.success(`Branch '${branchToDelete}' deleted successfully`);
        setBranchToDelete(null);
      } else {
        Alert.error(response.error); // Use the Alert component for error
      }
    } catch (error) {
      Alert.error('An unexpected error occurred while deleting the branch.');
      console.error('Error deleting branch:', error);
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Git Branches">
      <div className="space-y-4 text-xs">
        <div>
          <h3 className="text-lg font-medium mb-2 text-gray-100">Branches:</h3>
          <ul className="space-y-2">
            {branches.map((branch, index) => (
              <li
                key={index} // Ensure you use a unique key
                className={`flex items-center justify-between p-2 rounded ${
                  branch.name === currentBranch ? 'border border-blue-400 bg-gray-800' : 'bg-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className={branch.name === currentBranch ? 'text-white' : 'text-gray-300'}>
                    {branch.name ? branch.name : 'Unknown Branch'} {/* Fallback if branch.name is undefined */}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {branch.name !== currentBranch && (
                    <Tooltip content="Checkout">
                      <button
                        onClick={() => handleCheckout(branch.name)}
                        className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 hover:scale-105 transition-transform duration-200"
                        disabled={loadingAction === `checkout-${branch.name}`}
                      >
                        {loadingAction === `checkout-${branch.name}` ? (
                          <Loader size={14} className="animate-spin" />
                        ) : (
                          <ArrowRightCircle size={14} />
                        )}
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content="Branch Off">
                    <button
                      onClick={() => handleBranchOffClick(branch.name)}
                      className="p-1 bg-green-500 text-white rounded hover:bg-green-600 hover:scale-105 transition-transform duration-200"
                      disabled={loadingAction === 'branchOff'}
                    >
                      {loadingAction === 'branchOff' ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        <GitBranchPlus size={14} />
                      )}
                    </button>
                  </Tooltip>
                  {branch.name !== currentBranch && branch.name.toLowerCase() !== 'main' && (
                    <Tooltip content="Delete">
                      <button
                        onClick={() => confirmDeleteBranch(branch.name)}
                        className="p-1 bg-red-500 text-white rounded hover:bg-red-600 hover:scale-105 transition-transform duration-200"
                        disabled={loadingAction === `delete-${branch.name}`}
                      >
                        {loadingAction === `delete-${branch.name}` ? (
                          <Loader size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content="View on GitHub">
                    <button
                      onClick={() => handleOpenInGitHub(branch.name)}
                      className="p-1 bg-gray-600 text-white rounded hover:bg-gray-700 hover:scale-105 transition-transform duration-200"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {branchOffMode && (
          <div className="flex items-center space-x-2 mt-4">
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => validateBranchName(e.target.value)}
              placeholder={`New branch from ${branchOffMode}`}
              className={`flex-grow p-2 border rounded bg-gray-800 text-gray-300 ${!validBranchName ? 'border-red-500' : ''}`}
            />
            <button
              onClick={handleBranchOff}
              disabled={!newBranchName || !validBranchName || loadingAction === 'branchOff'}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs"
            >
              {loadingAction === 'branchOff' ? 'Creating...' : 'Create'}
            </button>
          </div>
        )}
        {branchToDelete && (
          <div className="mt-4 text-sm text-gray-200">
            <p>Are you sure you want to delete the branch <strong>{branchToDelete}</strong>? This action cannot be undone.</p>
            <div className="flex space-x-4 mt-2">
              <button
                onClick={handleDeleteBranch}
                disabled={loadingAction === `delete-${branchToDelete}`}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs"
              >
                {loadingAction === `delete-${branchToDelete}` ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => setBranchToDelete(null)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SettingsBranchModal;
