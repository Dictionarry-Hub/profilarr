import React from 'react';
import { CheckSquare, GitCommit, RotateCcw, Loader } from 'lucide-react';
import Textarea from '../ui/TextArea';
import Tooltip from '../ui/Tooltip';

const CommitSection = ({ status, commitMessage, setCommitMessage, handleStageAll, handleCommitAll, handleRevertAll, loadingAction }) => {
  const hasUnstagedChanges = status.changes.some(change => !change.staged || (change.staged && change.modified));
  const hasStagedChanges = status.changes.some(change => change.staged);
  const hasAnyChanges = status.changes.length > 0;

  const funMessages = [
    "No changes detected. Your regex is so precise, it could find a needle in a haystack... made of needles. 🧵🔍",
    "All quiet on the commit front. Your custom formats are so perfect, even perfectionists are jealous. 🏆",
    "No updates needed. Your media automation is running so smoothly, it's making butter jealous. 🧈",
    "Zero modifications. Your torrent setup is seeding so efficiently, farmers are asking for advice. 🌾",
    "No edits required. Your regex fu is so strong, it's bench-pressing parentheses for fun. 💪()",
    "Unchanged status. Your Plex library is so well-organized, librarians are taking notes. 📚🤓",
    "No alterations found. Your file naming scheme is so consistent, it's bringing tears to OCD eyes. 😢👀",
    "All systems nominal. Your download queue is so orderly, it's making Marie Kondo question her career. 🧹✨",
    "No revisions necessary. Your automation scripts are so smart, they're solving captchas for fun. 🤖🧩",
    "Steady as she goes. Your media collection is so complete, Netflix is asking you for recommendations. 🎬👑"
  ];

  const randomMessage = funMessages[Math.floor(Math.random() * funMessages.length)];

  const CommitButton = () => (
    <button
      onClick={handleCommitAll}
      className="flex items-center justify-center px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
      disabled={loadingAction === 'commit_all' || !commitMessage.trim()}
    >
      {loadingAction === 'commit_all' ? <Loader size={16} className="animate-spin mr-2" /> : <GitCommit className="mr-2" size={16} />}
      Commit All
    </button>
  );

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-100 mb-4">Changes:</h3>
      {hasAnyChanges ? (
        <>
          {hasStagedChanges && (
            <Textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Enter your commit message here..."
              className="w-full p-2 text-sm text-gray-200 bg-gray-600 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y h-[75px] mb-2"
            />
          )}
          <div className="flex justify-end space-x-2">
            {hasUnstagedChanges && (
              <button
                onClick={handleStageAll}
                className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                disabled={loadingAction === 'stage_all'}
              >
                {loadingAction === 'stage_all' ? <Loader size={16} className="animate-spin mr-2" /> : <CheckSquare className="mr-2" size={16} />}
                Stage All
              </button>
            )}
            {hasStagedChanges && (
              !commitMessage.trim() ? (
                <Tooltip content="Commit message is required">
                  <CommitButton />
                </Tooltip>
              ) : (
                <CommitButton />
              )
            )}
            <button
              onClick={handleRevertAll}
              className="flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
              disabled={loadingAction === 'revert_all'}
            >
              {loadingAction === 'revert_all' ? <Loader size={16} className="animate-spin mr-2" /> : <RotateCcw className="mr-2" size={16} />}
              Revert All
            </button>
          </div>
        </>
      ) : (
        <div className="text-gray-300 text-sm italic">{randomMessage}</div>
      )}
    </div>
  );
};

export default CommitSection;