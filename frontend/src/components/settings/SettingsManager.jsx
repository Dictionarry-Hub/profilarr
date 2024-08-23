import React, { useState, useEffect } from "react";
import {
  getSettings,
  saveSettings,
  getGitStatus,
  addFiles,
  pushFiles,
  revertFile,
  revertAll,
  deleteFile,
  pullBranch,
  getDiff,
} from "../../api/api";
import SettingsModal from "./SettingsModal";
import SettingsBranchModal from "./SettingsBranchModal";
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
} from "lucide-react";
import Alert from "../ui/Alert";
import CommitSection from "./CommitSection";
import Tooltip from "../ui/Tooltip";
import DiffModal from "./DiffModal";

const SettingsManager = () => {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [commitMessage, setCommitMessage] = useState("");
  const [selectedIncomingChanges, setSelectedIncomingChanges] = useState([]);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffContent, setDiffContent] = useState("");
  const [currentChange, setCurrentChange] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

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
      console.error("Error fetching settings:", error);
    }
  };

  const handleSaveSettings = async (newSettings) => {
    try {
      setLoadingAction("save_settings"); // Set a loading state if needed
      const response = await saveSettings(newSettings);

      if (response) {
        setSettings(response); // Update the settings in the state
        Alert.success("Settings saved successfully!");
        await fetchGitStatus(); // Optionally refresh the Git status after saving
      } else {
        Alert.error("Failed to save settings. Please try again.");
      }
    } catch (error) {
      Alert.error("An unexpected error occurred while saving the settings.");
      console.error("Error saving settings:", error);
    } finally {
      setLoadingAction(""); // Reset the loading state
      setShowModal(false); // Close the modal after saving
    }
  };

  const fetchGitStatus = async () => {
    setLoadingStatus(true);
    try {
      const result = await getGitStatus();
      console.log("================ Git Status Response ================");
      console.log(JSON.stringify(result, null, 2));
      console.log("======================================================");

      if (result.success) {
        setStatus({
          ...result.data,
          outgoing_changes: Array.isArray(result.data.outgoing_changes)
            ? result.data.outgoing_changes
            : [],
          incoming_changes: Array.isArray(result.data.incoming_changes)
            ? result.data.incoming_changes
            : [],
        });
      }
    } catch (error) {
      console.error("Error fetching Git status:", error);
      Alert.error("Failed to fetch Git status");
    } finally {
      setLoadingStatus(false);
    }
  };

  const renderChangeTable = (changes, title, icon, isIncoming) => (
    <div className="mb-4">
      <h4 className="text-sm font-medium text-gray-200 mb-2 flex items-center">
        {icon}
        <span>
          {title} ({changes.length})
        </span>
      </h4>
      <div className="border border-gray-600 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-600">
            <tr>
              <th className="px-4 py-2 text-left text-gray-300 w-1/4">
                Status
              </th>
              <th className="px-4 py-2 text-left text-gray-300 w-1/4">Type</th>
              <th className="px-4 py-2 text-left text-gray-300 w-1/3">Name</th>
              {isIncoming && (
                <th className="px-4 py-2 text-left text-gray-300 w-1/6">
                  Actions
                </th>
              )}
              {isIncoming && (
                <th className="px-4 py-2 text-right text-gray-300 w-1/12">
                  Select
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {changes.map((change, index) => (
              <tr
                key={`${isIncoming ? "incoming" : "outgoing"}-${index}`}
                className={`border-t border-gray-600 cursor-pointer hover:bg-gray-700 ${
                  selectedIncomingChanges.includes(change.file_path)
                    ? "bg-gray-700"
                    : ""
                }`}
                onClick={() => handleSelectChange(change.file_path)}
              >
                <td className="px-4 py-2 text-gray-300">
                  <div className="flex items-center">
                    {getStatusIcon(change.status)}
                    <span className="ml-2">
                      {change.staged
                        ? `${change.status} (Staged)`
                        : change.status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 text-gray-300">
                  <div className="flex items-center">
                    {getTypeIcon(change.type)}
                    <span className="ml-2">{change.type}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-gray-300">
                  {change.name || "Unnamed"}
                </td>
                {isIncoming && (
                  <td className="px-4 py-2 text-left align-middle">
                    <Tooltip content="View differences">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDiff(change); // Pass the change object to view its diff
                        }}
                        className="flex items-center justify-center px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs"
                        style={{ width: "100%" }} // Ensure the button takes up the full width of the cell
                      >
                        {loadingDiff ? (
                          <Loader size={12} className="animate-spin" />
                        ) : (
                          <>
                            <Eye size={12} className="mr-1" />
                            View Diff
                          </>
                        )}
                      </button>
                    </Tooltip>
                  </td>
                )}
                {isIncoming && (
                  <td className="px-4 py-2 text-right text-gray-300 align-middle">
                    <input
                      type="checkbox"
                      checked={selectedIncomingChanges.includes(
                        change.file_path
                      )}
                      onChange={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isIncoming && changes.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handlePullSelectedChanges}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 ease-in-out text-xs"
            disabled={
              loadingAction === "pull_changes" ||
              selectedIncomingChanges.length === 0
            }
          >
            {loadingAction === "pull_changes" ? (
              <Loader size={12} className="animate-spin" />
            ) : (
              <Download className="mr-1" size={12} />
            )}
            Pull Selected Changes
          </button>
        </div>
      )}
    </div>
  );

  const handleViewDiff = async (change) => {
    setLoadingDiff(true); // Start loading
    try {
      const response = await getDiff(change.file_path);
      if (response.success) {
        setDiffContent(response.diff); // Store the diff content
        setCurrentChange(change); // Set the current change being viewed
        setShowDiffModal(true); // Open the modal
      } else {
        Alert.error(response.error);
      }
    } catch (error) {
      Alert.error("An unexpected error occurred while fetching the diff.");
      console.error("Error fetching diff:", error);
    } finally {
      setLoadingDiff(false); // Stop loading
      setLoadingAction("");
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
      Alert.error("An unexpected error occurred while adding the file.");
      console.error("Error adding untracked file:", error);
    } finally {
      setLoadingAction("");
    }
  };

  const handleStageAll = async () => {
    const unstagedChanges = status.outgoing_changes.filter(
      (change) => !change.staged || (change.staged && change.modified)
    );

    if (unstagedChanges.length === 0) {
      Alert.warning("There are no changes to stage.");
      return;
    }
    setLoadingAction("stage_all");
    try {
      const response = await addFiles([]);
      if (response.success) {
        await fetchGitStatus();
        Alert.success(response.message);
      } else {
        Alert.error(response.error);
      }
    } catch (error) {
      Alert.error("An unexpected error occurred while staging files.");
      console.error("Error staging files:", error);
    } finally {
      setLoadingAction("");
    }
  };

  const handleCommitAll = async () => {
    if (
      !status.outgoing_changes ||
      !status.outgoing_changes.some((change) => change.staged)
    ) {
      Alert.warning("There are no staged changes to commit.");
      return;
    }

    if (!commitMessage.trim()) {
      Alert.warning("Please enter a commit message.");
      return;
    }

    setLoadingAction("commit_all");
    try {
      const stagedFiles = status.outgoing_changes
        .filter((change) => change.staged)
        .map((change) => change.file_path);
      const response = await pushFiles(stagedFiles, commitMessage);
      if (response.success) {
        await fetchGitStatus();
        setCommitMessage("");
        Alert.success(response.message);
      } else {
        Alert.error(response.error);
      }
    } catch (error) {
      Alert.error("An unexpected error occurred while committing files.");
      console.error("Error committing files:", error);
    } finally {
      setLoadingAction("");
    }
  };

  const handleRevertFile = async (filePath) => {
    const fileToRevert = status.changes.find(
      (change) => change.file_path === filePath
    );

    const isDeletedFile =
      fileToRevert && fileToRevert.status.includes("Deleted");

    if (
      !fileToRevert ||
      (!fileToRevert.staged && !fileToRevert.modified && !isDeletedFile)
    ) {
      Alert.warning("There is nothing to revert for this file.");
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
      Alert.error("An unexpected error occurred while reverting the file.");
      console.error("Error reverting file:", error);
    } finally {
      setLoadingAction("");
    }
  };

  const handleRevertAll = async () => {
    const hasChangesToRevert = status.changes.some(
      (change) => change.staged || change.modified
    );

    if (!hasChangesToRevert) {
      Alert.warning("There are no changes to revert.");
      return;
    }

    setLoadingAction("revert_all");
    try {
      const response = await revertAll();
      if (response.success) {
        await fetchGitStatus();
        Alert.success(response.message);
      } else {
        Alert.error(response.error);
      }
    } catch (error) {
      Alert.error("An unexpected error occurred while reverting all changes.");
      console.error("Error reverting all changes:", error);
    } finally {
      setLoadingAction("");
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
      Alert.error("An unexpected error occurred while deleting the file.");
      console.error("Error deleting file:", error);
    } finally {
      setLoadingAction("");
    }
  };

  const handlePullSelectedChanges = async () => {
    if (selectedIncomingChanges.length === 0) {
      Alert.warning("Please select at least one change to pull.");
      return;
    }

    setLoadingAction("pull_changes");
    try {
      // You would need to update your backend to handle pulling specific files
      const response = await pullBranch(status.branch, selectedIncomingChanges);
      if (response.success) {
        await fetchGitStatus();
        setSelectedIncomingChanges([]); // Clear the selected changes after pulling
        Alert.success(response.message);
      } else {
        Alert.error(response.error);
      }
    } catch (error) {
      Alert.error("An unexpected error occurred while pulling changes.");
      console.error("Error pulling changes:", error);
    } finally {
      setLoadingAction("");
    }
  };

  const handleSelectChange = (filePath) => {
    setSelectedIncomingChanges((prevSelected) => {
      if (prevSelected.includes(filePath)) {
        return prevSelected.filter((path) => path !== filePath);
      } else {
        return [...prevSelected, filePath];
      }
    });
  };

  const getActionButton = (change) => {
    if (change.status === "Untracked") {
      return (
        <button
          onClick={() => handleDeleteFile(change.file_path)}
          className="flex items-center px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
          disabled={loadingAction === `delete-${change.file_path}`}
        >
          {loadingAction === `delete-${change.file_path}` ? (
            <Loader size={12} className="animate-spin" />
          ) : (
            <MinusCircle className="mr-1" size={12} />
          )}
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
          {loadingAction === `revert-${change.file_path}` ? (
            <Loader size={12} className="animate-spin" />
          ) : (
            <RotateCcw className="mr-1" size={12} />
          )}
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
    "Reading the project's diary...",
  ];

  const getRandomLoadingMessage = () => {
    return loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Untracked":
        return <Plus className="text-blue-400" size={16} />;
      case "Staged (New)":
        return <Plus className="text-green-400" size={16} />;
      case "Staged (Modified)":
      case "Modified":
        return <Edit className="text-yellow-400" size={16} />;
      case "Deleted":
        return <MinusCircle className="text-red-400" size={16} />;
      case "Deleted (Staged)":
        return <MinusCircle className="text-red-600" size={16} />;
      case "Renamed":
        return <GitBranch className="text-purple-400" size={16} />;
      default:
        return <AlertCircle className="text-gray-400" size={16} />;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "Regex Pattern":
        return <Code className="text-blue-400" size={16} />;
      case "Custom Format":
        return <FileText className="text-green-400" size={16} />;
      default:
        return <AlertCircle className="text-gray-400" size={16} />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-gray-100">
        Git Repository Settings
      </h2>
      {settings && (
        <div className="space-y-4">
          <div className="bg-gray-700 p-4 rounded-md">
            <h3 className="text-sm font-semibold text-gray-100 mb-2">
              Connected Repository
            </h3>
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
            <h3 className="text-sm font-semibold text-gray-100 mb-2">
              Git Status
            </h3>
            {loadingStatus ? (
              <div className="flex items-center justify-center">
                <Loader size={24} className="animate-spin text-gray-300" />
                <span className="ml-2 text-gray-300 text-sm">
                  {getRandomLoadingMessage()}
                </span>
              </div>
            ) : (
              status && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <GitBranch className="mr-2 text-green-400" size={14} />
                      <span className="text-gray-200 text-sm">
                        Current Branch: {status.branch}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowBranchModal(true)}
                      className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 ease-in-out text-xs"
                    >
                      <Eye size={14} className="mr-2" />
                      View Branches
                    </button>
                  </div>

                  {status.incoming_changes.length > 0 &&
                    renderChangeTable(
                      status.incoming_changes,
                      "Incoming Changes",
                      <ArrowDown className="text-yellow-400 mr-2" size={16} />,
                      true
                    )}
                  {status.outgoing_changes.length > 0 &&
                    renderChangeTable(
                      status.outgoing_changes,
                      "Outgoing Changes",
                      <ArrowUp className="text-blue-400 mr-2" size={16} />,
                      false
                    )}

                  <CommitSection
                    status={status}
                    commitMessage={commitMessage}
                    setCommitMessage={setCommitMessage}
                    handleStageAll={handleStageAll}
                    handleCommitAll={handleCommitAll}
                    handleRevertAll={handleRevertAll}
                    loadingAction={loadingAction}
                    hasIncomingChanges={status.incoming_changes.length > 0}
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
    </div>
  );
};

export default SettingsManager;
