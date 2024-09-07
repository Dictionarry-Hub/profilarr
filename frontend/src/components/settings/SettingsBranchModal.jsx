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
    CloudUpload,
    Search
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
    const [filteredBranches, setFilteredBranches] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
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

    useEffect(() => {
        setFilteredBranches(
            branches.filter(branch =>
                branch.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [branches, searchTerm]);

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
        setSearchTerm('');
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title='Manage Git Branches'
            size='4xl'>
            <div className='space-y-6'>
                <div className='bg-gray-100 dark:bg-gray-800 rounded-lg p-4'>
                    <div className='relative mb-4'>
                        <input
                            type='text'
                            placeholder='Search branches...'
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className='w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'
                        />
                        <Search className='absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500' />
                    </div>

                    <div className='overflow-visible'>
                        <ul className='space-y-2'>
                            {filteredBranches.map((branch, index) => (
                                <li
                                    key={index}
                                    className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                                        branch.name === currentBranch
                                            ? 'bg-blue-100 dark:bg-blue-900/50'
                                            : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}>
                                    <div className='flex items-center space-x-3'>
                                        <div
                                            className={`w-3 h-3 rounded-full ${
                                                branch.name === currentBranch
                                                    ? 'bg-blue-500'
                                                    : 'bg-gray-400 dark:bg-gray-500'
                                            }`}></div>
                                        <span
                                            className={`font-medium ${
                                                branch.name === currentBranch
                                                    ? 'text-blue-700 dark:text-blue-300'
                                                    : 'text-gray-700 dark:text-gray-200'
                                            }`}>
                                            {branch.name || 'Unknown Branch'}
                                        </span>
                                        <span className='text-xs text-gray-500 dark:text-gray-400'>
                                            {branch.isLocal && !branch.isRemote
                                                ? '(Local)'
                                                : !branch.isLocal &&
                                                    branch.isRemote
                                                  ? '(Remote)'
                                                  : '(Local & Remote)'}
                                        </span>
                                    </div>
                                    <div className='flex items-center space-x-2'>
                                        {/* Keep existing buttons with updated styles */}
                                        {branch.name !== currentBranch && (
                                            <Tooltip content='Checkout'>
                                                <button
                                                    onClick={() =>
                                                        handleCheckout(
                                                            branch.name
                                                        )
                                                    }
                                                    className='p-3 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full transition-colors'
                                                    disabled={
                                                        loadingAction ===
                                                        `checkout-${branch.name}`
                                                    }>
                                                    {loadingAction ===
                                                    `checkout-${branch.name}` ? (
                                                        <Loader
                                                            size={20}
                                                            className='animate-spin'
                                                        />
                                                    ) : (
                                                        <ArrowRightCircle
                                                            size={20}
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
                                                className='p-3 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 rounded-full transition-colors'
                                                disabled={
                                                    loadingAction ===
                                                    'branchOff'
                                                }>
                                                {loadingAction ===
                                                'branchOff' ? (
                                                    <Loader
                                                        size={20}
                                                        className='animate-spin'
                                                    />
                                                ) : (
                                                    <GitBranchPlus size={20} />
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
                                                        className='p-3 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full transition-colors'
                                                        disabled={
                                                            loadingAction ===
                                                            `push-${branch.name}`
                                                        }>
                                                        {loadingAction ===
                                                        `push-${branch.name}` ? (
                                                            <Loader
                                                                size={20}
                                                                className='animate-spin'
                                                            />
                                                        ) : (
                                                            <CloudUpload
                                                                size={20}
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
                                                        className='p-3 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800 rounded-full transition-colors'
                                                        disabled={
                                                            loadingAction ===
                                                            `delete-${branch.name}`
                                                        }>
                                                        {loadingAction ===
                                                        `delete-${branch.name}` ? (
                                                            <Loader
                                                                size={20}
                                                                className='animate-spin'
                                                            />
                                                        ) : (
                                                            <Trash2 size={20} />
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
                                                    className='p-3 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors'>
                                                    <ExternalLink size={20} />
                                                </button>
                                            </Tooltip>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {branchOffMode && (
                    <div className='bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-md'>
                        <h4 className='text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200'>
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
                                className={`flex-grow p-2 rounded-lg border ${
                                    !validBranchName
                                        ? 'border-red-500 dark:border-red-400'
                                        : 'border-gray-300 dark:border-gray-600'
                                } bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400`}
                            />
                            <button
                                onClick={handleBranchOff}
                                disabled={
                                    !newBranchName ||
                                    !validBranchName ||
                                    loadingAction === 'branchOff'
                                }
                                className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm disabled:opacity-50'>
                                {loadingAction === 'branchOff'
                                    ? 'Creating...'
                                    : 'Create'}
                            </button>
                        </div>
                    </div>
                )}

                {branchToDelete && (
                    <div className='bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-4 text-sm text-red-800 dark:text-red-200'>
                        <p className='mb-3'>
                            Are you sure you want to delete the branch{' '}
                            <strong>{branchToDelete}</strong>? This action
                            cannot be undone.
                        </p>
                        <div className='flex space-x-4'>
                            <button
                                onClick={handleDeleteBranch}
                                disabled={
                                    loadingAction === `delete-${branchToDelete}`
                                }
                                className='px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium shadow-sm disabled:opacity-50'>
                                {loadingAction === `delete-${branchToDelete}`
                                    ? 'Deleting...'
                                    : 'Confirm Delete'}
                            </button>
                            <button
                                onClick={() => setBranchToDelete(null)}
                                className='px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm font-medium shadow-sm'>
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
