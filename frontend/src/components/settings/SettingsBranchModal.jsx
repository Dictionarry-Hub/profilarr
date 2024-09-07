import React, {useState, useEffect} from 'react';
import Modal from '../ui/Modal';
import {
    getBranches,
    checkoutBranch,
    createBranch,
    deleteBranch,
    pushBranchToRemote
} from '../../api/api';
import {
    ExternalLink,
    Trash2,
    GitBranchPlus,
    ArrowRightCircle,
    Loader,
    CloudUpload
} from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import Alert from '../ui/Alert';

const SettingsBranchModal = ({
    isOpen,
    onClose,
    repoUrl,
    currentBranch,
    onBranchChange,
    isDevMode
}) => {
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

    const handleCheckout = async branchName => {
        setLoadingAction(`checkout-${branchName}`);
        try {
            const response = await checkoutBranch(branchName);
            if (response.success) {
                await fetchBranches();
                onBranchChange();
                Alert.success('Branch checked out successfully');
                onClose();
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            if (
                error.response &&
                error.response.status === 400 &&
                error.response.data.error
            ) {
                Alert.error(error.response.data.error);
            } else {
                Alert.error(
                    'An unexpected error occurred while checking out the branch.'
                );
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
                const response = await createBranch(
                    newBranchName,
                    branchOffMode
                );
                if (response.success) {
                    await fetchBranches();
                    onBranchChange();
                    Alert.success('Branch created successfully');
                    resetForm();
                } else {
                    Alert.error(response.error);
                }
            } catch (error) {
                if (
                    error.response &&
                    error.response.status === 400 &&
                    error.response.data.error
                ) {
                    Alert.error(error.response.data.error);
                } else {
                    console.error('Error branching off:', error);
                    Alert.error(
                        'An unexpected error occurred while creating the branch. Please try again.'
                    );
                }
            } finally {
                setLoadingAction('');
            }
        } else {
            Alert.error('Please enter a valid branch name.');
        }
    };

    const handleBranchOffClick = branchName => {
        setBranchOffMode(branchName);
        setNewBranchName('');
        setValidBranchName(true);
    };

    const validateBranchName = name => {
        const isValid = /^[a-zA-Z0-9._-]+$/.test(name);
        setValidBranchName(isValid);
        setNewBranchName(name);
    };

    const handleOpenInGitHub = branchName => {
        const branchUrl = `${repoUrl}/tree/${encodeURIComponent(branchName)}`;
        window.open(branchUrl, '_blank');
    };

    const confirmDeleteBranch = branchName => {
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
                onBranchChange();
                await fetchBranches();
                Alert.success(
                    `Branch '${branchToDelete}' deleted successfully`
                );
                setBranchToDelete(null);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            Alert.error(
                'An unexpected error occurred while deleting the branch.'
            );
            console.error('Error deleting branch:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const handlePushToRemote = async branchName => {
        setLoadingAction(`push-${branchName}`);
        try {
            const response = await pushBranchToRemote(branchName);
            if (response.success) {
                Alert.success(
                    `Branch '${branchName}' pushed to remote successfully`
                );
                await fetchBranches();
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            Alert.error(
                'An unexpected error occurred while pushing the branch to remote.'
            );
            console.error('Error pushing branch to remote:', error);
        } finally {
            setLoadingAction('');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title='Manage Git Branches'>
            <div className='space-y-6 text-sm'>
                <div className='bg-gray-800 rounded-lg p-4 shadow-inner'>
                    <h3 className='text-lg font-semibold mb-3 text-gray-100 border-b border-gray-700 pb-2'>
                        Branches
                    </h3>
                    <ul className='space-y-3'>
                        {branches.map((branch, index) => (
                            <li
                                key={index}
                                className={`flex items-center justify-between p-3 rounded-md transition-all duration-200 ${
                                    branch.name === currentBranch
                                        ? 'bg-blue-900/30 border border-blue-500 shadow-md'
                                        : 'bg-gray-700 hover:bg-gray-650'
                                }`}>
                                <div className='flex items-center space-x-3'>
                                    <div
                                        className={`w-2 h-2 rounded-full ${
                                            branch.name === currentBranch
                                                ? 'bg-blue-400'
                                                : 'bg-gray-400'
                                        }`}></div>
                                    <span
                                        className={`font-medium ${
                                            branch.name === currentBranch
                                                ? 'text-blue-200'
                                                : 'text-gray-200'
                                        }`}>
                                        {branch.name || 'Unknown Branch'}
                                    </span>
                                    <span className='text-xs text-gray-400'>
                                        {branch.isLocal && !branch.isRemote
                                            ? '(Local)'
                                            : !branch.isLocal && branch.isRemote
                                              ? '(Remote)'
                                              : '(Local & Remote)'}
                                    </span>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    {branch.name !== currentBranch && (
                                        <Tooltip content='Checkout'>
                                            <button
                                                onClick={() =>
                                                    handleCheckout(branch.name)
                                                }
                                                className='p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 hover:scale-105 transition-all duration-200 shadow-sm'
                                                disabled={
                                                    loadingAction ===
                                                    `checkout-${branch.name}`
                                                }>
                                                {loadingAction ===
                                                `checkout-${branch.name}` ? (
                                                    <Loader
                                                        size={16}
                                                        className='animate-spin'
                                                    />
                                                ) : (
                                                    <ArrowRightCircle
                                                        size={16}
                                                    />
                                                )}
                                            </button>
                                        </Tooltip>
                                    )}
                                    <Tooltip content='Branch Off'>
                                        <button
                                            onClick={() =>
                                                handleBranchOffClick(
                                                    branch.name
                                                )
                                            }
                                            className='p-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 hover:scale-105 transition-all duration-200 shadow-sm'
                                            disabled={
                                                loadingAction === 'branchOff'
                                            }>
                                            {loadingAction === 'branchOff' ? (
                                                <Loader
                                                    size={16}
                                                    className='animate-spin'
                                                />
                                            ) : (
                                                <GitBranchPlus size={16} />
                                            )}
                                        </button>
                                    </Tooltip>
                                    {branch.isLocal &&
                                        !branch.isRemote &&
                                        isDevMode && (
                                            <Tooltip content='Push to Remote'>
                                                <button
                                                    onClick={() =>
                                                        handlePushToRemote(
                                                            branch.name
                                                        )
                                                    }
                                                    className='p-1.5 bg-purple-500 text-white rounded-md hover:bg-purple-600 hover:scale-105 transition-all duration-200 shadow-sm'
                                                    disabled={
                                                        loadingAction ===
                                                        `push-${branch.name}`
                                                    }>
                                                    {loadingAction ===
                                                    `push-${branch.name}` ? (
                                                        <Loader
                                                            size={16}
                                                            className='animate-spin'
                                                        />
                                                    ) : (
                                                        <CloudUpload
                                                            size={16}
                                                        />
                                                    )}
                                                </button>
                                            </Tooltip>
                                        )}
                                    {(branch.isLocal ||
                                        (branch.isRemote && isDevMode)) &&
                                        branch.name !== currentBranch &&
                                        branch.name.toLowerCase() !==
                                            'stable' && (
                                            <Tooltip content='Delete'>
                                                <button
                                                    onClick={() =>
                                                        confirmDeleteBranch(
                                                            branch.name
                                                        )
                                                    }
                                                    className='p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 hover:scale-105 transition-all duration-200 shadow-sm'
                                                    disabled={
                                                        loadingAction ===
                                                        `delete-${branch.name}`
                                                    }>
                                                    {loadingAction ===
                                                    `delete-${branch.name}` ? (
                                                        <Loader
                                                            size={16}
                                                            className='animate-spin'
                                                        />
                                                    ) : (
                                                        <Trash2 size={16} />
                                                    )}
                                                </button>
                                            </Tooltip>
                                        )}

                                    {branch.isRemote && (
                                        <Tooltip content='View on GitHub'>
                                            <button
                                                onClick={() =>
                                                    handleOpenInGitHub(
                                                        branch.name
                                                    )
                                                }
                                                className='p-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-500 hover:scale-105 transition-all duration-200 shadow-sm'>
                                                <ExternalLink size={16} />
                                            </button>
                                        </Tooltip>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                {branchOffMode && (
                    <div className='bg-gray-700 p-4 rounded-lg shadow-md'>
                        <h4 className='text-sm font-semibold mb-2 text-gray-200'>
                            Create New Branch
                        </h4>
                        <div className='flex items-center space-x-2'>
                            <input
                                type='text'
                                value={newBranchName}
                                onChange={e =>
                                    validateBranchName(e.target.value)
                                }
                                placeholder={`New branch from ${branchOffMode}`}
                                className={`flex-grow p-2 border rounded bg-gray-800 text-gray-300 focus:ring-2 focus:ring-blue-500 transition-all ${
                                    !validBranchName
                                        ? 'border-red-500'
                                        : 'border-gray-600'
                                }`}
                            />
                            <button
                                onClick={handleBranchOff}
                                disabled={
                                    !newBranchName ||
                                    !validBranchName ||
                                    loadingAction === 'branchOff'
                                }
                                className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm'>
                                {loadingAction === 'branchOff'
                                    ? 'Creating...'
                                    : 'Create'}
                            </button>
                        </div>
                    </div>
                )}
                {branchToDelete && (
                    <div className='bg-red-900/30 border border-red-500 rounded-lg p-4 mt-4 text-sm text-gray-200'>
                        <p className='mb-3'>
                            Are you sure you want to delete the branch{' '}
                            <strong className='text-red-300'>
                                {branchToDelete}
                            </strong>
                            ? This action cannot be undone.
                        </p>
                        <div className='flex space-x-4'>
                            <button
                                onClick={handleDeleteBranch}
                                disabled={
                                    loadingAction === `delete-${branchToDelete}`
                                }
                                className='px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm font-medium shadow-sm'>
                                {loadingAction === `delete-${branchToDelete}`
                                    ? 'Deleting...'
                                    : 'Confirm Delete'}
                            </button>
                            <button
                                onClick={() => setBranchToDelete(null)}
                                className='px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm font-medium shadow-sm'>
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
