import React from 'react';
import PropTypes from 'prop-types';
import Modal from '../ui/Modal';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const DiffModal = ({ isOpen, onClose, diffContent, type, name, commitMessage, title = "View Diff" }) => {
    const formatDiffContent = (content) => {
        return content
          .split('\n')
          .filter(line => 
            !line.startsWith('diff --git') && 
            !line.startsWith('index') && 
            !line.startsWith('---') && 
            !line.startsWith('+++') &&
            !line.startsWith('@@')
          )
          .map((line, index) => {
            let className = 'pl-2';
            let lineBackground = '';
      
            if (line.startsWith('+')) {
              className += ' text-green-400'; // Green for additions
              lineBackground = 'bg-green-900'; // Darker green background
            } else if (line.startsWith('-')) {
              className += ' text-red-400'; // Red for deletions
              lineBackground = 'bg-red-900'; // Darker red background
            } else if (line.startsWith('@@')) {
              className += ' text-yellow-400'; // Yellow for diff hunk headers
              lineBackground = 'bg-gray-700'; // Neutral background
            } else {
              lineBackground = 'bg-gray-800'; // Default background for unchanged lines
            }
      
            return (
              <div
                key={index}
                className={`${lineBackground} ${className} py-1 flex`}
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} // Ensure long lines are wrapped properly
              >
                <span className="inline-block w-12 text-gray-600 select-none text-right pr-2">{index + 1}</span>
                <span className="ml-2">{line}</span>
              </div>
            );
          });
      };
      
      

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="mb-4 p-4 bg-gray-700 rounded-lg shadow-md">
        <div className="flex flex-col space-y-2">
          <div>
            <span className="font-bold text-gray-300">Type: </span>
            <span className="text-gray-100">{type}</span>
          </div>
          <div>
            <span className="font-bold text-gray-300">Name: </span>
            <span className="text-gray-100">{name}</span>
          </div>
          {commitMessage && (
            <div>
              <span className="font-bold text-gray-300">Commit Message: </span>
              <span className="text-gray-100">{commitMessage}</span>
            </div>
          )}
        </div>
      </div>
      <div
        className="bg-gray-900 p-4 rounded-lg shadow-inner"
        style={{ overflowX: 'auto' }} // Add horizontal scrolling
        >
        <div
            className="text-sm text-gray-100 font-mono"
            style={{
            whiteSpace: 'pre-wrap', // Wrap lines
            wordWrap: 'break-word', // Break long words
            }}
        >
            {formatDiffContent(diffContent || "No differences found.")}
        </div>
        </div>

    </Modal>
  );
};

DiffModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  diffContent: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  commitMessage: PropTypes.string,
  title: PropTypes.string,
};

export default DiffModal;
