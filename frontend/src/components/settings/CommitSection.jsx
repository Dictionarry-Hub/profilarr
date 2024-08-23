import React from "react";
import Textarea from "../ui/TextArea";

const CommitSection = ({
  status,
  commitMessage,
  setCommitMessage,
  hasIncomingChanges,
}) => {
  const hasUnstagedChanges = status.outgoing_changes.some(
    (change) => !change.staged || (change.staged && change.modified)
  );
  const hasStagedChanges = status.outgoing_changes.some(
    (change) => change.staged
  );
  const hasAnyChanges = status.outgoing_changes.length > 0;

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
    "Steady as she goes. Your media collection is so complete, Netflix is asking you for recommendations. 🎬👑",
  ];

  const randomMessage =
    funMessages[Math.floor(Math.random() * funMessages.length)];

  return (
    <div className="mt-4">
      {hasAnyChanges || hasIncomingChanges ? (
        <>
          {hasStagedChanges && (
            <>
              <h3 className="text-sm font-semibold text-gray-100 mb-4">
                Commit Message:
              </h3>
              <Textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Enter your commit message here..."
                className="w-full p-2 text-sm text-gray-200 bg-gray-600 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y h-[75px] mb-2"
              />
            </>
          )}
        </>
      ) : (
        <div className="text-gray-300 text-sm italic">{randomMessage}</div>
      )}
    </div>
  );
};

export default CommitSection;
