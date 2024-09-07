import React, {useState, useEffect} from 'react';
import {
    getSettings,
    getGitStatus,
    addFiles,
    pushFiles,
    revertFile,
    pullBranch,
    getDiff,
    unlinkRepo
} from '../../api/api';
import ApiKeyModal from './ApiKeyModal';
import UnlinkModal from './UnlinkModal';
import SettingsBranchModal from './SettingsBranchModal';
import {
    FileText,
    Code,
    AlertCircle,
    Plus,
    MinusCircle,
    Edit,
    GitBranch,
    Loader,
    Eye,
    RotateCcw,
    Download,
    ArrowDown,
    ArrowUp,
    CheckCircle,
    File,
    Settings,
    Unlink
} from 'lucide-react';
import Alert from '../ui/Alert';
import CommitSection from './CommitSection';
import Tooltip from '../ui/Tooltip';
import DiffModal from './DiffModal';

const SettingsPage = () => {
    const [settings, setSettings] = useState(null);
    const [status, setStatus] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [loadingAction, setLoadingAction] = useState('');
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [commitMessage, setCommitMessage] = useState('');
    const [showUnlinkModal, setShowUnlinkModal] = useState(false);
    const [selectedIncomingChanges, setSelectedIncomingChanges] = useState([]);
    const [selectedOutgoingChanges, setSelectedOutgoingChanges] = useState([]);
    const [showDiffModal, setShowDiffModal] = useState(false);
    const [diffContent, setDiffContent] = useState('');
    const [currentChange, setCurrentChange] = useState(null);
    const [loadingDiff, setLoadingDiff] = useState(false);
    const [selectionType, setSelectionType] = useState(null);
    const [sortConfig, setSortConfig] = useState({
        key: 'type',
        direction: 'descending'
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const fetchedSettings = await getSettings();
            setSettings(fetchedSettings);
            if (fetchedSettings) {
                await fetchGitStatus();
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const sortedChanges = changes => {
        if (!sortConfig.key) return changes;

        return [...changes].sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    };

    const requestSort = key => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({key, direction});
    };

    const SortableHeader = ({children, sortKey}) => {
        const isSorted = sortConfig.key === sortKey;
        return (
            <th
                className='px-4 py-2 text-left text-gray-300 cursor-pointer hover:bg-gray-500'
                onClick={() => requestSort(sortKey)}>
                <div className='flex items-center'>
                    {children}
                    {isSorted &&
                        (sortConfig.direction === 'ascending' ? (
                            <ArrowUp size={14} className='ml-1' />
                        ) : (
                            <ArrowDown size={14} className='ml-1' />
                        ))}
                </div>
            </th>
        );
    };

    const fetchGitStatus = async () => {
        setLoadingStatus(true);
        try {
            const result = await getGitStatus();
            console.log(
                '================ Git Status Response ================'
            );
            console.log(JSON.stringify(result, null, 2));
            console.log(
                '======================================================'
            );

            if (result.success) {
                setStatus({
                    ...result.data,
                    outgoing_changes: Array.isArray(
                        result.data.outgoing_changes
                    )
                        ? result.data.outgoing_changes
                        : [],
                    incoming_changes: Array.isArray(
                        result.data.incoming_changes
                    )
                        ? result.data.incoming_changes
                        : []
                });
            }
        } catch (error) {
            console.error('Error fetching Git status:', error);
            Alert.error('Failed to fetch Git status');
        } finally {
            setLoadingStatus(false);
        }
    };

    const renderChangeTable = (changes, title, icon, isIncoming) => (
        <div className='mb-4'>
            <h4 className='text-sm font-medium text-gray-200 mb-2 flex items-center'>
                {icon}
                <span>
                    {title} ({changes.length})
                </span>
            </h4>
            <div className='border border-gray-600 rounded-md overflow-hidden'>
                <table className='w-full text-sm'>
                    <thead className='bg-gray-600'>
                        <tr>
                            <SortableHeader sortKey='status'>
                                Status
                            </SortableHeader>
                            <SortableHeader sortKey='type'>Type</SortableHeader>
                            <SortableHeader sortKey='name'>Name</SortableHeader>
                            <th className='px-4 py-2 text-left text-gray-300 w-1/5'>
                                Actions
                            </th>
                            <th className='px-4 py-2 text-right text-gray-300 w-1/10'>
                                Select
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedChanges(changes).map((change, index) => (
                            <tr
                                key={`${isIncoming ? 'incoming' : 'outgoing'}-${index}`}
                                className={`border-t border-gray-600 cursor-pointer hover:bg-gray-700 ${
                                    (isIncoming
                                        ? selectedIncomingChanges
                                        : selectedOutgoingChanges
                                    ).includes(change.file_path)
                                        ? 'bg-gray-700'
                                        : ''
                                }`}
                                onClick={() =>
                                    handleSelectChange(
                                        change.file_path,
                                        isIncoming
                                    )
                                }>
                                <td className='px-4 py-2 text-gray-300'>
                                    <div className='flex items-center'>
                                        {getStatusIcon(change.status)}
                                        <span className='ml-2'>
                                            {change.staged
                                                ? `${change.status} (Staged)`
                                                : change.status}
                                        </span>
                                    </div>
                                </td>
                                <td className='px-4 py-2 text-gray-300'>
                                    <div className='flex items-center'>
                                        {getTypeIcon(change.type)}
                                        <span className='ml-2'>
                                            {change.type}
                                        </span>
                                    </div>
                                </td>
                                <td className='px-4 py-2 text-gray-300'>
                                    {change.name || 'Unnamed'}
                                </td>
                                <td className='px-4 py-2 text-left align-middle'>
                                    <Tooltip content='View differences'>
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                handleViewDiff(change);
                                            }}
                                            className='flex items-center justify-center px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs'
                                            style={{width: '100%'}}>
                                            {loadingDiff ? (
                                                <Loader
                                                    size={12}
                                                    className='animate-spin'
                                                />
                                            ) : (
                                                <>
                                                    <Eye
                                                        size={12}
                                                        className='mr-1'
                                                    />
                                                    View Diff
                                                </>
                                            )}
                                        </button>
                                    </Tooltip>
                                </td>
                                <td className='px-4 py-2 text-right text-gray-300 align-middle'>
                                    <input
                                        type='checkbox'
                                        checked={(isIncoming
                                            ? selectedIncomingChanges
                                            : selectedOutgoingChanges
                                        ).includes(change.file_path)}
                                        onChange={e => e.stopPropagation()}
                                        disabled={!isIncoming && change.staged}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const getStageButtonTooltip = () => {
        if (selectionType === 'staged') {
            return 'These files are already staged';
        }
        if (selectedOutgoingChanges.length === 0) {
            return 'Select files to stage';
        }
        return 'Stage selected files';
    };

    const getCommitButtonTooltip = () => {
        if (selectionType === 'unstaged') {
            return 'You can only commit staged files';
        }
        if (selectedOutgoingChanges.length === 0) {
            return 'Select files to commit';
        }
        if (!commitMessage.trim()) {
            return 'Enter a commit message';
        }
        return 'Commit selected files';
    };

    const getRevertButtonTooltip = () => {
        if (selectedOutgoingChanges.length === 0) {
            return 'Select files to revert';
        }
        return 'Revert selected files';
    };

    const handleViewDiff = async change => {
        setLoadingDiff(true);
        try {
            const response = await getDiff(change.file_path);
            console.log('Diff response:', response); // Add this line to log the response
            if (response.success) {
                console.log('Diff content:', response.diff); // Add this line to log the diff content
                setDiffContent(response.diff);
                setCurrentChange(change);
                setShowDiffModal(true);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            Alert.error(
                'An unexpected error occurred while fetching the diff.'
            );
            console.error('Error fetching diff:', error);
        } finally {
            setLoadingDiff(false);
            setLoadingAction('');
        }
    };

    const handleStageSelectedChanges = async () => {
        if (selectedOutgoingChanges.length === 0) {
            Alert.warning('Please select at least one change to stage.');
            return;
        }

        setLoadingAction('stage_selected');
        try {
            const response = await addFiles(selectedOutgoingChanges);
            if (response.success) {
                await fetchGitStatus();
                setSelectedOutgoingChanges([]); // Clear the selected changes after staging
                Alert.success(response.message);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            Alert.error('An unexpected error occurred while staging changes.');
            console.error('Error staging changes:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const handleCommitSelectedChanges = async () => {
        if (selectedOutgoingChanges.length === 0) {
            Alert.warning('Please select at least one change to commit.');
            return;
        }

        if (!commitMessage.trim()) {
            Alert.warning('Please enter a commit message.');
            return;
        }

        setLoadingAction('commit_selected');
        try {
            const response = await pushFiles(
                selectedOutgoingChanges,
                commitMessage
            );
            if (response.success) {
                await fetchGitStatus();
                setSelectedOutgoingChanges([]); // Clear the selected changes after committing
                setCommitMessage('');
                Alert.success(response.message);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            Alert.error(
                'An unexpected error occurred while committing changes.'
            );
            console.error('Error committing changes:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const handleRevertSelectedChanges = async () => {
        if (selectedOutgoingChanges.length === 0) {
            Alert.warning('Please select at least one change to revert.');
            return;
        }

        setLoadingAction('revert_selected');
        try {
            const response = await Promise.all(
                selectedOutgoingChanges.map(filePath => revertFile(filePath))
            );
            const allSuccessful = response.every(res => res.success);
            if (allSuccessful) {
                await fetchGitStatus();
                setSelectedOutgoingChanges([]); // Clear the selected changes after reverting
                Alert.success(
                    'Selected changes have been reverted successfully.'
                );
            } else {
                Alert.error(
                    'Some changes could not be reverted. Please try again.'
                );
            }
        } catch (error) {
            Alert.error(
                'An unexpected error occurred while reverting changes.'
            );
            console.error('Error reverting changes:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const handlePullSelectedChanges = async () => {
        if (selectedIncomingChanges.length === 0) {
            Alert.warning('Please select at least one change to pull.');
            return;
        }

        setLoadingAction('pull_changes');
        try {
            // You would need to update your backend to handle pulling specific files
            const response = await pullBranch(
                status.branch,
                selectedIncomingChanges
            );
            if (response.success) {
                await fetchGitStatus();
                setSelectedIncomingChanges([]); // Clear the selected changes after pulling
                Alert.success(response.message);
            } else {
                Alert.error(response.error);
            }
        } catch (error) {
            Alert.error('An unexpected error occurred while pulling changes.');
            console.error('Error pulling changes:', error);
        } finally {
            setLoadingAction('');
        }
    };

    const handleSelectChange = (filePath, isIncoming) => {
        if (isIncoming) {
            setSelectedIncomingChanges(prevSelected => {
                if (prevSelected.includes(filePath)) {
                    return prevSelected.filter(path => path !== filePath);
                } else {
                    return [...prevSelected, filePath];
                }
            });
        } else {
            const change = status.outgoing_changes.find(
                c => c.file_path === filePath
            );
            const isStaged = change.staged;

            setSelectedOutgoingChanges(prevSelected => {
                if (prevSelected.includes(filePath)) {
                    const newSelection = prevSelected.filter(
                        path => path !== filePath
                    );
                    if (newSelection.length === 0) setSelectionType(null);
                    return newSelection;
                } else {
                    if (
                        prevSelected.length === 0 ||
                        (isStaged && selectionType === 'staged') ||
                        (!isStaged && selectionType === 'unstaged')
                    ) {
                        setSelectionType(isStaged ? 'staged' : 'unstaged');
                        return [...prevSelected, filePath];
                    } else {
                        return prevSelected;
                    }
                }
            });
        }
    };

    const loadingMessages = [
        "Checking for changes... don't blink!",
        'Syncing with the mothership...',
        'Peeking under the hood...',
        'Counting bits and bytes...',
        'Scanning for modifications...',
        'Looking for new stuff...',
        'Comparing local and remote...',
        "Checking your project's pulse...",
        "Analyzing your code's mood...",
        "Reading the project's diary..."
    ];

    const getRandomLoadingMessage = () => {
        return loadingMessages[
            Math.floor(Math.random() * loadingMessages.length)
        ];
    };

    const getStatusIcon = status => {
        switch (status) {
            case 'Untracked':
                return <Plus className='text-blue-400' size={16} />;
            case 'Staged (New)':
                return <Plus className='text-green-400' size={16} />;
            case 'Staged (Modified)':
            case 'Modified':
                return <Edit className='text-yellow-400' size={16} />;
            case 'Deleted':
                return <MinusCircle className='text-red-400' size={16} />;
            case 'Deleted (Staged)':
                return <MinusCircle className='text-red-600' size={16} />;
            case 'Renamed':
                return <GitBranch className='text-purple-400' size={16} />;
            default:
                return <AlertCircle className='text-gray-400' size={16} />;
        }
    };

    const getTypeIcon = type => {
        switch (type) {
            case 'Regex Pattern':
                return <Code className='text-blue-400' size={16} />;
            case 'Custom Format':
                return <FileText className='text-green-400' size={16} />;
            case 'Quality Profile':
                return <Settings className='text-purple-400' size={16} />;
            default:
                return <File className='text-gray-400' size={16} />;
        }
    };

    const handleLinkRepo = async () => {
        setLoadingAction('');
        setShowModal(false);
        await fetchSettings();
    };

    const handleUnlinkRepo = async removeFiles => {
        setLoadingAction('unlink_repo');
        try {
            const response = await unlinkRepo(removeFiles);
            if (response.success) {
                setSettings(null);
                setStatus(null);
                Alert.success('Repository unlinked successfully');
                setShowUnlinkModal(false); // Close the modal after unlinking
            } else {
                Alert.error(response.error || 'Failed to unlink repository');
            }
        } catch (error) {
            Alert.error(
                'An unexpected error occurred while unlinking the repository'
            );
            console.error('Error unlinking repository:', error);
        } finally {
            setLoadingAction('');
        }
    };

    return (
        <div className='max-w-4xl mx-auto mt-8 p-6 bg-gray-800 rounded-lg shadow-lg'>
            <h2 className='text-xl font-bold mb-4 text-gray-100'>
                Git Repository Settings
            </h2>
            {!settings && (
                <button
                    onClick={() => setShowModal(true)}
                    className='flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 ease-in-out text-xs'>
                    Link Repository
                </button>
            )}
            {settings && (
                <div className='space-y-4'>
                    <div className='bg-gray-700 p-4 rounded-md'>
                        <h3 className='text-sm font-semibold text-gray-100 mb-2'>
                            Connected Repository
                        </h3>
                        <div className='flex items-center justify-between'>
                            <a
                                href={settings.gitRepo}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-blue-400 hover:text-blue-300 transition-colors text-sm'>
                                {settings.gitRepo}
                            </a>
                            <Tooltip content='Unlink Repository'>
                                <button
                                    onClick={() => setShowUnlinkModal(true)} // Change this line to open the modal
                                    className='flex items-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 ease-in-out text-xs'
                                    disabled={loadingAction === 'unlink_repo'}>
                                    {loadingAction === 'unlink_repo' ? (
                                        <Loader
                                            size={14}
                                            className='animate-spin'
                                        />
                                    ) : (
                                        <Unlink size={14} className='mr-2' />
                                    )}
                                    Unlink
                                </button>
                            </Tooltip>
                        </div>
                    </div>

                    <div className='bg-gray-700 p-4 rounded-md'>
                        <h3 className='text-sm font-semibold text-gray-100 mb-2'>
                            Git Status
                        </h3>
                        {loadingStatus ? (
                            <div className='flex items-center justify-center'>
                                <Loader
                                    size={24}
                                    className='animate-spin text-gray-300'
                                />
                                <span className='ml-2 text-gray-300 text-sm'>
                                    {getRandomLoadingMessage()}
                                </span>
                            </div>
                        ) : (
                            status && (
                                <>
                                    <div className='flex items-center justify-between mb-4'>
                                        <div className='flex items-center'>
                                            <GitBranch
                                                className='mr-2 text-green-400'
                                                size={14}
                                            />
                                            <span className='text-gray-200 text-sm'>
                                                Current Branch: {status.branch}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() =>
                                                setShowBranchModal(true)
                                            }
                                            className='flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 ease-in-out text-xs'>
                                            <Eye size={14} className='mr-2' />
                                            View Branches
                                        </button>
                                    </div>

                                    {status.incoming_changes.length > 0 &&
                                        renderChangeTable(
                                            status.incoming_changes,
                                            'Incoming Changes',
                                            <ArrowDown
                                                className='text-yellow-400 mr-2'
                                                size={16}
                                            />,
                                            true
                                        )}
                                    {status.outgoing_changes.length > 0 &&
                                        renderChangeTable(
                                            status.outgoing_changes,
                                            'Outgoing Changes',
                                            <ArrowUp
                                                className='text-blue-400 mr-2'
                                                size={16}
                                            />,
                                            false
                                        )}

                                    <CommitSection
                                        status={status}
                                        commitMessage={commitMessage}
                                        setCommitMessage={setCommitMessage}
                                        loadingAction={loadingAction}
                                        hasIncomingChanges={
                                            status.incoming_changes.length > 0
                                        }
                                    />

                                    {/* Buttons Below Commit Section */}
                                    <div className='mt-4 flex justify-end space-x-2'>
                                        {/* Conditionally render Stage button */}
                                        {selectedOutgoingChanges.length > 0 &&
                                            selectionType !== 'staged' && (
                                                <Tooltip
                                                    content={getStageButtonTooltip()}>
                                                    <button
                                                        onClick={
                                                            handleStageSelectedChanges
                                                        }
                                                        className='flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 ease-in-out text-xs'
                                                        disabled={
                                                            loadingAction ===
                                                            'stage_selected'
                                                        }>
                                                        {loadingAction ===
                                                        'stage_selected' ? (
                                                            <Loader
                                                                size={12}
                                                                className='animate-spin'
                                                            />
                                                        ) : (
                                                            <Plus
                                                                className='mr-1'
                                                                size={12}
                                                            />
                                                        )}
                                                        Stage Selected
                                                    </button>
                                                </Tooltip>
                                            )}

                                        {/* Conditionally render Commit button */}
                                        {selectedOutgoingChanges.length > 0 &&
                                            commitMessage.trim() &&
                                            selectionType !== 'unstaged' && (
                                                <Tooltip
                                                    content={getCommitButtonTooltip()}>
                                                    <button
                                                        onClick={
                                                            handleCommitSelectedChanges
                                                        }
                                                        className='flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 ease-in-out text-xs'
                                                        disabled={
                                                            loadingAction ===
                                                            'commit_selected'
                                                        }>
                                                        {loadingAction ===
                                                        'commit_selected' ? (
                                                            <Loader
                                                                size={12}
                                                                className='animate-spin'
                                                            />
                                                        ) : (
                                                            <CheckCircle
                                                                className='mr-1'
                                                                size={12}
                                                            />
                                                        )}
                                                        Commit Selected
                                                    </button>
                                                </Tooltip>
                                            )}

                                        {/* Conditionally render Revert button */}
                                        {selectedOutgoingChanges.length > 0 && (
                                            <Tooltip
                                                content={getRevertButtonTooltip()}>
                                                <button
                                                    onClick={
                                                        handleRevertSelectedChanges
                                                    }
                                                    className='flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 ease-in-out text-xs'
                                                    disabled={
                                                        loadingAction ===
                                                        'revert_selected'
                                                    }>
                                                    {loadingAction ===
                                                    'revert_selected' ? (
                                                        <Loader
                                                            size={12}
                                                            className='animate-spin'
                                                        />
                                                    ) : (
                                                        <RotateCcw
                                                            className='mr-1'
                                                            size={12}
                                                        />
                                                    )}
                                                    Revert Selected
                                                </button>
                                            </Tooltip>
                                        )}
                                        {/* Conditionally render Pull button */}
                                        {selectedIncomingChanges.length > 0 && (
                                            <Tooltip content='Pull selected changes'>
                                                <button
                                                    onClick={
                                                        handlePullSelectedChanges
                                                    }
                                                    className='flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors duration-200 ease-in-out text-xs'
                                                    disabled={
                                                        loadingAction ===
                                                        'pull_changes'
                                                    }>
                                                    {loadingAction ===
                                                    'pull_changes' ? (
                                                        <Loader
                                                            size={12}
                                                            className='animate-spin'
                                                        />
                                                    ) : (
                                                        <Download
                                                            className='mr-1'
                                                            size={12}
                                                        />
                                                    )}
                                                    Pull Selected
                                                </button>
                                            </Tooltip>
                                        )}
                                    </div>
                                </>
                            )
                        )}
                    </div>
                </div>
            )}
            {settings && status && (
                <SettingsBranchModal
                    isOpen={showBranchModal}
                    onClose={() => setShowBranchModal(false)}
                    repoUrl={settings.gitRepo}
                    currentBranch={status.branch}
                    onBranchChange={fetchGitStatus}
                />
            )}
            {showDiffModal && currentChange && (
                <DiffModal
                    isOpen={showDiffModal}
                    onClose={() => setShowDiffModal(false)}
                    diffContent={diffContent}
                    type={currentChange.type}
                    name={currentChange.name}
                    commitMessage={currentChange.commit_message}
                />
            )}
            <ApiKeyModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={handleLinkRepo}
            />
            <UnlinkModal
                isOpen={showUnlinkModal}
                onClose={() => setShowUnlinkModal(false)}
                onSubmit={handleUnlinkRepo}
            />
        </div>
    );
};

export default SettingsPage;
