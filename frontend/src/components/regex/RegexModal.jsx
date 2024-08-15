import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { saveRegex, deleteRegex, createRegex101Link } from '../../api/api';
import Modal from '../ui/Modal';

function RegexModal({ regex = null, isOpen, onClose, onSave }) {
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [regex101Link, setRegex101Link] = useState('');
  const [error, setError] = useState('');
  const initialRegexRef = useRef(regex);

  useEffect(() => {
    if (isOpen) {
      initialRegexRef.current = regex;
      if (regex) {
        setName(regex.name);
        setPattern(regex.pattern);
        setDescription(regex.description);
        setTags(regex.tags || []);
        setRegex101Link(regex.regex101Link || '');
      } else {
        setName('');
        setPattern('');
        setDescription('');
        setTags([]);
        setRegex101Link('');
      }
      setError('');
      setNewTag('');
    }
  }, [regex, isOpen]);

  const handleCreateRegex101Link = async () => {
    try {
      const response = await createRegex101Link({
        regex: pattern,
        flavor: 'pcre',
        flags: 'gm',
        delimiter: '/',
      });
      const permalinkFragment = response.permalinkFragment;

      const regex101Link = `https://regex101.com/r/${permalinkFragment}`;
      setRegex101Link(regex101Link);

      await saveRegex({
        id: regex ? regex.id : 0,
        name,
        pattern,
        description,
        tags,
        regex101Link,
      });

      window.open(regex101Link, '_blank');
      onSave(); // Refresh the list after saving
      setError('');
    } catch (error) {
      console.error('Error creating regex101 link:', error);
      setError('Failed to create regex101 link. Please try again.');
    }
  };

  const handleRemoveRegex101Link = async () => {
    setRegex101Link('');  // Clear the regex101Link in state

    try {
      await saveRegex({
        id: regex ? regex.id : 0,
        name,
        pattern,
        description,
        tags,
        regex101Link: '',  // Save the regex with an empty link
      });

      onSave(); // Refresh the list after saving
      setError('');
    } catch (error) {
      console.error('Error removing regex101 link:', error);
      setError('Failed to remove regex101 link. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !pattern.trim() || !description.trim()) {
      setError('Name, pattern, and description are all required.');
      return;
    }
    try {
      await saveRegex({ 
        id: regex ? regex.id : 0, 
        name, 
        pattern, 
        description, 
        tags,
        regex101Link
      });
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving regex:', error);
      setError('Failed to save regex. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (regex && regex.id) {
      try {
        await deleteRegex(regex.id);
        onSave();
        onClose();
      } catch (error) {
        console.error('Error deleting regex:', error);
        setError('Failed to delete regex. Please try again.');
      }
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={initialRegexRef.current ? 'Edit Regex Pattern' : 'Add Regex Pattern'}
    >
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Regex Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter regex name"
          className="w-full p-2 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Regex Pattern
        </label>
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="Enter regex pattern"
          className="w-full p-2 border rounded font-mono dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter description"
          className="w-full p-2 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tags
        </label>
        <div className="flex flex-wrap mb-2">
          {tags.map(tag => (
            <span key={tag} className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
              {tag}
              <button onClick={() => handleRemoveTag(tag)} className="ml-1 text-xs">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add a tag"
            className="flex-grow p-2 border rounded-l dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
          />
          <button
            onClick={handleAddTag}
            className="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
      <div className="mb-4">
        {regex101Link ? (
          <>
            <p className="mt-2">
              <a
                href={regex101Link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Open in Regex101
              </a>
            </p>
            <button
              onClick={handleRemoveRegex101Link}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors mt-2"
            >
              Remove Link
            </button>
          </>
        ) : (
          <button
            onClick={handleCreateRegex101Link}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
          >
            Create Tests
          </button>
        )}
      </div>
      <div className="flex justify-between">
        <button
          onClick={handleSave}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Save
        </button>
        {regex && (
          <button
            onClick={handleDelete}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </Modal>
  );
}

RegexModal.propTypes = {
  regex: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string.isRequired,
    pattern: PropTypes.string.isRequired,
    description: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    regex101Link: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default RegexModal;
