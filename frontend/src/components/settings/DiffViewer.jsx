import React from 'react';
import Modal from '../ui/Modal';

const DiffViewer = ({ isOpen, onClose, diffContent = [] }) => {
  // Ensure diffContent is an array before proceeding
  if (!Array.isArray(diffContent)) {
    diffContent = []; // Default to an empty array if diffContent is not an array
  }

  // Separate content for local and incoming
  const localContent = diffContent.filter(line => line.type === 'local' || line.type === 'context' || line.type === 'unchanged');
  const incomingContent = diffContent.filter(line => line.type === 'incoming' || line.type === 'context' || line.type === 'unchanged');

  const renderDiffColumn = (content) => {
    return content.map((line, index) => {
      let lineClass = 'text-gray-200'; // Default line class for unchanged lines

      if (line.type === 'local') {
        lineClass = 'bg-red-400 text-black'; // Highlight local changes
      } else if (line.type === 'incoming') {
        lineClass = 'bg-yellow-400 text-black'; // Highlight incoming changes
      } else if (line.type === 'context') {
        lineClass = 'text-gray-400'; // Context lines
      }

      return (
        <div key={index} className={`p-1 ${lineClass}`}>
          {line.text}
        </div>
      );
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Diff Viewer"
      size="xl" // Making the modal larger
    >
      <div className="bg-gray-900 p-4 rounded-md overflow-auto text-xs flex space-x-4">
        <div className="w-1/2">
          <h3 className="text-gray-300 mb-2">Remote</h3>
          <div className="bg-gray-800 p-2 rounded-md">
            {renderDiffColumn(localContent)}
          </div>
        </div>
        <div className="w-1/2">
          <h3 className="text-gray-300 mb-2">Local</h3>
          <div className="bg-gray-800 p-2 rounded-md">
            {renderDiffColumn(incomingContent)}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DiffViewer;
