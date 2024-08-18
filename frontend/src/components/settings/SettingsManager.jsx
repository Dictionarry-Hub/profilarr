import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, getGitStatus, pullBranch, addFiles, pushFiles, revertFile, revertAll, deleteFile } from '../../api/api';
import SettingsModal from './SettingsModal';
import SettingsBranchModal from './SettingsBranchModal';
import DiffViewer from './DiffViewer';
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
  RotateCcw 
} from 'lucide-react';
import Alert from '../ui/Alert';
import CommitSection from './CommitSection';

const SettingsManager = () => {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffContent, setDiffContent] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);  

  const fetchSettings = async () => {
    try {
      const fetchedSettings = await getSettings();
      if (fetchedSettings) {
        setSettings(fetchedSettings);
        await fetchGitStatus();
      } else {
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSaveSettings = async (newSettings) => {
    try {
      setLoadingAction('save_settings');  // Set a loading state if needed
      const response = await saveSettings(newSettings);
      
      if (response) {
        setSettings(response);  // Update the settings in the state
        Alert.success('Settings saved successfully!');
        await fetchGitStatus(); // Optionally refresh the Git status after saving
      } else {
        Alert.error('Failed to save settings. Please try again.');
      }
    } catch (error) {
      Alert.error('An unexpected error occurred while saving the settings.');
      console.error('Error saving settings:', error);
    } finally {
      setLoadingAction('');  // Reset the loading state
      setShowModal(false);   // Close the modal after saving
    }
  };
  
  const fetchGitStatus = async () => {
    setLoadingStatus(true);
    try {
      const result = await getGitStatus();
      console.log('================ Git Status Response ================');
      console.log(JSON.stringify(result, null, 2));
      console.log('======================================================');
      
      if (result.success) {
        setStatus({
          ...result.data,
          changes: Array.isArray(result.data.changes) ? result.data.changes : [],
        });
      }
    } catch (error) {
      console.error('Error fetching Git status:', error);
      Alert.error('Failed to fetch Git status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleAddFile = async (filePath) => {
    setLoadingAction(`add-${filePath}`);
    try {
      const response = await addFiles([filePath]);
      if (response.success) {
        await fetchGitStatus(); // Refresh status
        Alert.success(response.message);
      } else {
        Alert.error(response.error);
      }
    } catch (error) {
      Alert.error('An unexpected error occurred while adding the file.');
      console.error('Error adding untracked file:', error);
    } finally {
      setLoadingAction('');
    }
  };

  const handleStageAll = async () => {
    const unstagedChanges = status.changes.filter(change => 
      !change.staged || (change.staged && change.modified)
    );
  
    if (unstagedChanges.length === 0) {
      Alert.warning('There are no changes to stage.');
      return;
    }
  
    setLoadingAction('stage_all');
    try {
      const response = await addFiles([]);
      if (response.success) {
        await fetchGitStatus();
        Alert.success(response.message);
      } else {
        Alert.error(response.error);
      }
    } catch (error) {
      Alert.error('An unexpected error occurred while staging files.');
      console.error('Error staging files:', error);
    } finally {
      setLoadingAction('');
    }
  };

  const handleCommitAll = async () => {
    if (!status.changes || !status.changes.some(change => change.staged)) {
      Alert.warning('There are no staged changes to commit.');
      return;
    }

    if (!commitMessage.trim()) {
      Alert.warning('Please enter a commit message.');
      return;
    }

    setLoadingAction('commit_all');
    try {
      const stagedFiles = status.changes.filter(change => change.staged).map(change => change.file_path);
      const response = await pushFiles(stagedFiles, commitMessage);
      if (response.success) {
        await fetchGitStatus();
        setCommitMessage('');
        Alert.success(response.message);
      } else {
        Alert.error(response.error);
      }
    } catch (error) {
      Alert.error('An unexpected error occurred while committing files.');
      console.error('Error committing files:', error);
    } finally {
      setLoadingAction('');
    }
  };

  const handleRevertFile = async (filePath) => {
    const fileToRevert = status.changes.find(change => change.file_path === filePath);

    const isDeletedFile = fileToRevert && fileToRevert.status.includes('Deleted');

    if (!fileToRevert || (!fileToRevert.staged && !fileToRevert.modified && !isDeletedFile)) {
        Alert.warning('There is nothing to revert for this file.');
        return;
    }

    setLoadingAction(`revert-${filePath}`);
    try {
        const response = await revertFile(filePath);
        if (response.success) {
            await fetchGitStatus();
            Alert.success(response.message);
        } else {
            Alert.error(response.error);
        }
    } catch (error) {
        Alert.error('An unexpected error occurred while reverting the file.');
        console.error('Error reverting file:', error);
    } finally {
        setLoadingAction('');
    }
  };

  const handleRevertAll = async () => {
    const hasChangesToRevert = status.changes.some(change => change.staged || change.modified);

    if (!hasChangesToRevert) {
        Alert.warning('There are no changes to revert.');
        return;
    }

    setLoadingAction('revert_all');
    try {
        const response = await revertAll();
        if (response.success) {
            await fetchGitStatus();
            Alert.success(response.message);
        } else {
            Alert.error(response.error);
        }
    } catch (error) {
        Alert.error('An unexpected error occurred while reverting all changes.');
        console.error('Error reverting all changes:', error);
    } finally {
      setLoadingAction('');
    }
  };

  const handleDeleteFile = async (filePath) => {
    setLoadingAction(`delete-${filePath}`);
    try {
        const response = await deleteFile(filePath);
        if (response.success) {
            await fetchGitStatus(); // Refresh the status after deletion
            Alert.success(`File ${filePath} has been deleted.`);
        } else {
            Alert.error(response.error);
        }
    } catch (error) {
        Alert.error('An unexpected error occurred while deleting the file.');
        console.error('Error deleting file:', error);
    } finally {
        setLoadingAction('');
    }
  };

  const getActionButton = (change) => {
    if (change.status === 'Untracked') {
        return (
            <button
                onClick={() => handleDeleteFile(change.file_path)}
                className="flex items-center px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                disabled={loadingAction === `delete-${change.file_path}`}
            >
                {loadingAction === `delete-${change.file_path}` ? <Loader size={12} className="animate-spin" /> : <MinusCircle className="mr-1" size={12} />}
                Delete
            </button>
        );
    } else {
        return (
            <button
                onClick={() => handleRevertFile(change.file_path)}
                className="flex items-center px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                disabled={loadingAction === `revert-${change.file_path}`}
            >
                {loadingAction === `revert-${change.file_path}` ? <Loader size={12} className="animate-spin" /> : <RotateCcw className="mr-1" size={12} />}
                Revert
            </button>
        );
    }
  };

  const loadingMessages = [
    "Checking for changes... don't blink!",
    "Syncing with the mothership...",
    "Peeking under the hood...",
    "Counting bits and bytes...",
    "Scanning for modifications...",
    "Looking for new stuff...",
    "Comparing local and remote...",
    "Checking your project's pulse...",
    "Analyzing your code's mood...",
    "Reading the project's diary..."
  ];
  
  const getRandomLoadingMessage = () => {
    return loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Untracked':
        return <Plus className="text-blue-400" size={16} />;
      case 'Staged (New)':
        return <Plus className="text-green-400" size={16} />;
      case 'Staged (Modified)':
      case 'Modified':
        return <Edit className="text-yellow-400" size={16} />;
      case 'Deleted':
        return <MinusCircle className="text-red-400" size={16} />;
      case 'Deleted (Staged)':
        return <MinusCircle className="text-red-600" size={16} />;
      case 'Renamed':
        return <GitBranch className="text-purple-400" size={16} />;
      default:
        return <AlertCircle className="text-gray-400" size={16} />;
    }
  };
  
  const getTypeIcon = (type) => {
    switch (type) {
      case 'Regex Pattern':
        return <Code className="text-blue-400" size={16} />;
      case 'Custom Format':
        return <FileText className="text-green-400" size={16} />;
      default:
        return <AlertCircle className="text-gray-400" size={16} />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-gray-100">Git Repository Settings</h2>
      {settings && (
        <div className="space-y-4">
          <div className="bg-gray-700 p-4 rounded-md">
            <h3 className="text-sm font-semibold text-gray-100 mb-2">Connected Repository</h3>
            <a
              href={settings.gitRepo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition-colors text-sm"
            >
              {settings.gitRepo}
            </a>
          </div>
  
          <div className="bg-gray-700 p-4 rounded-md">
            <h3 className="text-sm font-semibold text-gray-100 mb-2">Git Status</h3>
            {loadingStatus ? (
              <div className="flex items-center justify-center">
                <Loader size={24} className="animate-spin text-gray-300" />
                <span className="ml-2 text-gray-300 text-sm">{getRandomLoadingMessage()}</span>
              </div>
            ) : (
              status && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <GitBranch className="mr-2 text-green-400" size={14} />
                      <span className="text-gray-200 text-sm">Current Branch: {status.branch}</span>
                    </div>
                    <button
                      onClick={() => setShowBranchModal(true)}
                      className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 ease-in-out text-xs"
                    >
                      <Eye size={14} className="mr-2" />
                      View Branches
                    </button>

                  </div>
  
                  {status.changes.length > 0 && (
                    <div className="mb-2">
                      <h4 className="text-sm font-medium text-gray-200 mb-1">Changes:</h4>
                      <div className="grid grid-cols-5 gap-2 text-xs">
                        <div className="text-gray-400 font-semibold">Status</div>
                        <div className="text-gray-400 font-semibold">Type</div>
                        <div className="text-gray-400 font-semibold">Name</div>
                        <div className="text-gray-400 font-semibold text-right"></div>
                        <div className="text-gray-400 font-semibold text-right"></div>

                        {Array.isArray(status.changes) && status.changes.map((change, index) => (
                          <React.Fragment key={`change-${index}`}>
                            <div className="py-1 text-gray-300">
                              <div className="flex items-center">
                                {getStatusIcon(change.staged ? `${change.status} (Staged)` : change.status)}
                                <span className="ml-1">{change.staged ? `${change.status} (Staged)` : change.status}</span>
                              </div>
                            </div>
                            <div className="py-1 text-gray-300">
                              <div className="flex items-center">
                                {getTypeIcon(change.type)}
                                <span className="ml-1">{change.type}</span>
                              </div>
                            </div>
                            <div className="py-1 text-gray-300">{change.name || 'Unnamed'}</div>
                            <div className="py-1 text-right col-span-2">
                              <div className="inline-flex space-x-2">
                                {(!change.staged || change.modified) && (
                                  <button
                                    onClick={() => handleAddFile(change.file_path)}
                                    className="flex items-center px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs"
                                  >
                                    <Plus size={12} className="mr-1" />
                                    {change.staged ? 'Re-stage' : 'Stage'}
                                  </button>
                                )}
                                {getActionButton(change)}
                              </div>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

  
                  <CommitSection
                    status={status}
                    commitMessage={commitMessage}
                    setCommitMessage={setCommitMessage}
                    handleStageAll={handleStageAll}
                    handleCommitAll={handleCommitAll}
                    handleRevertAll={handleRevertAll}
                    loadingAction={loadingAction}
                  />
                </>
              )
            )}
          </div>
        </div>
      )}
      <SettingsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={(newSettings) => handleSaveSettings(newSettings)}
      />
      {settings && status && (
        <SettingsBranchModal
          isOpen={showBranchModal}
          onClose={() => setShowBranchModal(false)}
          repoUrl={settings.gitRepo}
          currentBranch={status.branch}
          onBranchChange={fetchGitStatus}
        />
      )}
      <DiffViewer
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        diffContent={diffContent}
      />
    </div>
  );
}

export default SettingsManager;
