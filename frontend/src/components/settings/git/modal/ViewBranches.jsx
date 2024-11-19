import React, {useState, useEffect} from 'react';
import Modal from '../../../ui/Modal';
import {
    getBranches,
    checkoutBranch,
    createBranch,
    deleteBranch,
    pushBranchToRemote
} from '../../../../api/api';
import {
    ExternalLink,
    Trash2,
    GitBranchPlus,
    ArrowRightCircle,
    Loader,
    CloudUpload,
    Search,
    Check
} from 'lucide-react';
import Tooltip from '../../../ui/Tooltip';
import Alert from '../../../ui/Alert';

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
    const [loadingAction, setLoadingAction] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);

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
        setLoadingAction('');
        setSearchTerm('');
        setConfirmAction(null);
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
                    Alert.error(response.error.error || response.error);
                }
            } catch (error) {
                if (error.response?.status === 409) {
                    Alert.error(
                        'Cannot perform operation - merge in progress. Please resolve conflicts first.'
                    );
                } else if (error.response?.status === 400) {
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

    const handleCheckout = async branchName => {
        if (confirmAction === `checkout-${branchName}`) {
            setLoadingAction(`checkout-${branchName}`);
            try {
                const response = await checkoutBranch(branchName);
                if (response.success) {
                    await fetchBranches();
                    onBranchChange();
                    Alert.success('Branch checked out successfully');
                    onClose();
                } else {
                    // The error is nested inside result.error from the backend
                    Alert.error(response.error.error || response.error);
                }
            } catch (error) {
                if (error.response?.status === 409) {
                    Alert.error(
                        'Cannot perform operation - merge in progress. Please resolve conflicts first.'
                    );
                } else if (error.response?.status === 400) {
                    Alert.error(error.response.data.error);
                } else {
                    Alert.error(
                        'An unexpected error occurred while checking out the branch.'
                    );
                    console.error('Error checking out branch:', error);
                }
            } finally {
                setLoadingAction('');
                setConfirmAction(null);
            }
        } else {
            setConfirmAction(`checkout-${branchName}`);
        }
    };

    const handleDeleteBranch = async branchName => {
        if (branchName.toLowerCase() === 'main') {
            Alert.warning("The 'main' branch cannot be deleted.");
            return;
        }
        if (confirmAction === `delete-${branchName}`) {
            setLoadingAction(`delete-${branchName}`);
            try {
                const response = await deleteBranch(branchName);
                if (response.success) {
                    onBranchChange();
                    await fetchBranches();
                    Alert.success(
                        `Branch '${branchName}' deleted successfully`
                    );
                } else {
                    Alert.error(response.error.error || response.error);
                }
            } catch (error) {
                if (error.response?.status === 409) {
                    Alert.error(
                        'Cannot perform operation - merge in progress. Please resolve conflicts first.'
                    );
                } else {
                    Alert.error(
                        'An unexpected error occurred while deleting the branch.'
                    );
                    console.error('Error deleting branch:', error);
                }
            } finally {
                setLoadingAction('');
                setConfirmAction(null);
            }
        } else {
            setConfirmAction(`delete-${branchName}`);
        }
    };
    const handlePushToRemote = async branchName => {
        if (confirmAction === `push-${branchName}`) {
            setLoadingAction(`push-${branchName}`);
            try {
                const response = await pushBranchToRemote(branchName);
                if (response.success) {
                    Alert.success(
                        `Branch '${branchName}' pushed to remote successfully`
                    );
                    await fetchBranches();
                } else {
                    Alert.error(response.error.error || response.error);
                }
            } catch (error) {
                if (error.response?.status === 409) {
                    Alert.error(
                        'Cannot perform operation - merge in progress. Please resolve conflicts first.'
                    );
                } else {
                    Alert.error(
                        'An unexpected error occurred while pushing the branch to remote.'
                    );
                    console.error('Error pushing branch to remote:', error);
                }
            } finally {
                setLoadingAction('');
                setConfirmAction(null);
            }
        } else {
            setConfirmAction(`push-${branchName}`);
        }
    };

    const buttonStyle = `
    p-2 relative transition-transform duration-200 ease-in-out
    hover:scale-110
  `;

    const iconStyle = ``;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title='Manage Git Branches'
            width='xl'
            height='auto'>
            <div className='space-y-6'>
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
                                className={`flex items-center justify-between px-4 py-2 rounded-lg transition-colors ${
                                    branch.name === currentBranch
                                        ? 'bg-blue-100 dark:bg-blue-900/50'
                                        : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}>
                                <div className='flex items-center space-x-3'>
                                    <div
                                        className={`w-3 h-3 rounded-full ${
                                            branch.name === currentBranch
                                                ? 'bg-green-500'
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
                                            : !branch.isLocal && branch.isRemote
                                            ? '(Remote)'
                                            : '(Local & Remote)'}
                                    </span>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    {/* Keep existing buttons with updated styles */}
                                    {branch.name !== currentBranch && (
                                        <Tooltip
                                            content={
                                                confirmAction ===
                                                `checkout-${branch.name}`
                                                    ? 'Confirm Checkout'
                                                    : 'Checkout'
                                            }>
                                            <button
                                                onClick={() =>
                                                    handleCheckout(branch.name)
                                                }
                                                className={`${buttonStyle} text-blue-600 dark:text-blue-400`}
                                                disabled={
                                                    loadingAction ===
                                                    `checkout-${branch.name}`
                                                }>
                                                {loadingAction ===
                                                `checkout-${branch.name}` ? (
                                                    <Loader
                                                        size={18}
                                                        className='animate-spin'
                                                    />
                                                ) : confirmAction ===
                                                  `checkout-${branch.name}` ? (
                                                    <Check
                                                        size={18}
                                                        className={iconStyle}
                                                    />
                                                ) : (
                                                    <ArrowRightCircle
                                                        size={18}
                                                        className={iconStyle}
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
                                            className={`${buttonStyle} text-green-600 dark:text-green-400`}
                                            disabled={
                                                loadingAction === 'branchOff'
                                            }>
                                            {loadingAction === 'branchOff' ? (
                                                <Loader
                                                    size={18}
                                                    className='animate-spin'
                                                />
                                            ) : (
                                                <GitBranchPlus
                                                    size={18}
                                                    className={iconStyle}
                                                />
                                            )}
                                        </button>
                                    </Tooltip>
                                    {branch.isLocal &&
                                        !branch.isRemote &&
                                        isDevMode && (
                                            <Tooltip
                                                content={
                                                    confirmAction ===
                                                    `push-${branch.name}`
                                                        ? 'Confirm Push'
                                                        : 'Push to Remote'
                                                }>
                                                <button
                                                    onClick={() =>
                                                        handlePushToRemote(
                                                            branch.name
                                                        )
                                                    }
                                                    className={`${buttonStyle} text-purple-600 dark:text-purple-400`}
                                                    disabled={
                                                        loadingAction ===
                                                        `push-${branch.name}`
                                                    }>
                                                    {loadingAction ===
                                                    `push-${branch.name}` ? (
                                                        <Loader
                                                            size={18}
                                                            className='animate-spin'
                                                        />
                                                    ) : confirmAction ===
                                                      `push-${branch.name}` ? (
                                                        <Check
                                                            size={18}
                                                            className={
                                                                iconStyle
                                                            }
                                                        />
                                                    ) : (
                                                        <CloudUpload
                                                            size={18}
                                                            className={
                                                                iconStyle
                                                            }
                                                        />
                                                    )}
                                                </button>
                                            </Tooltip>
                                        )}
                                    {(branch.isLocal ||
                                        (!branch.isRemote && isDevMode)) &&
                                        branch.name !== currentBranch &&
                                        branch.name.toLowerCase() !==
                                            'stable' && (
                                            <Tooltip
                                                content={
                                                    confirmAction ===
                                                    `delete-${branch.name}`
                                                        ? 'Confirm Delete'
                                                        : 'Delete'
                                                }>
                                                <button
                                                    onClick={() =>
                                                        handleDeleteBranch(
                                                            branch.name
                                                        )
                                                    }
                                                    className={`${buttonStyle} text-red-600 dark:text-red-400`}
                                                    disabled={
                                                        loadingAction ===
                                                        `delete-${branch.name}`
                                                    }>
                                                    {loadingAction ===
                                                    `delete-${branch.name}` ? (
                                                        <Loader
                                                            size={18}
                                                            className='animate-spin'
                                                        />
                                                    ) : confirmAction ===
                                                      `delete-${branch.name}` ? (
                                                        <Check
                                                            size={18}
                                                            className={
                                                                iconStyle
                                                            }
                                                        />
                                                    ) : (
                                                        <Trash2
                                                            size={18}
                                                            className={
                                                                iconStyle
                                                            }
                                                        />
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
                                                className={`${buttonStyle} text-gray-600 dark:text-gray-400`}>
                                                <ExternalLink
                                                    size={18}
                                                    className={iconStyle}
                                                />
                                            </button>
                                        </Tooltip>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {branchOffMode && (
                    <div className='bg-gray-100 dark:bg-gray-800 p-4 rounded-lg !mt-1'>
                        <div className='flex items-center space-x-2'>
                            <input
                                type='text'
                                value={newBranchName}
                                onChange={e =>
                                    validateBranchName(e.target.value)
                                }
                                placeholder={`New branch from ${branchOffMode}`}
                                className={`flex-grow p-2 h-9 rounded-lg border text-sm ${
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
                                className='px-4 h-9 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm disabled:opacity-50'>
                                {loadingAction === 'branchOff'
                                    ? 'Creating...'
                                    : 'Create'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default SettingsBranchModal;
