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
  const [isLoading, setIsLoading] = useState(false);
  const initialRegexRef = useRef(regex);

  useEffect(() => {
    if (isOpen) {
      if (regex && regex.id !== 0) { 
        initialRegexRef.current = regex;
        setName(regex.name);
        setPattern(regex.pattern);
        setDescription(regex.description);
        setTags(regex.tags || []);
        setRegex101Link(regex.regex101Link || '');
      } else {
        initialRegexRef.current = null;
        setName(regex ? regex.name : '');
        setPattern(regex ? regex.pattern : '');
        setDescription(regex ? regex.description : '');
        setTags(regex ? regex.tags : []);
        setRegex101Link('');
      }
      setError('');
      setNewTag('');
      setIsLoading(false);
    }
  }, [regex, isOpen]);
  

  const handleCreateRegex101Link = async () => {
    if (!pattern.trim()) {
      setError('Please provide a regex pattern before creating tests.');
      return;
    }

    // Define your unit tests here
    const unitTests = [
        {
            description: "Test if 'D-Z0N3' is detected correctly",
            testString: "Test D-Z0N3 pattern",
            criteria: "DOES_MATCH",
            target: "REGEX"
        },
        {
            description: "Test if 'random text' does not match",
            testString: "random text",
            criteria: "DOES_NOT_MATCH",
            target: "REGEX"
        }
        // Add more unit tests as needed
    ];

    setIsLoading(true);
    try {
        const response = await createRegex101Link({
            regex: pattern,
            flavor: 'pcre',
            flags: 'gmi',
            delimiter: '/',
            unitTests: unitTests
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
    } finally {
        setIsLoading(false);
    }
  };

  const handleRemoveRegex101Link = async () => {
    const confirmRemoval = window.confirm("Are you sure you want to remove this Regex101 link?");
    if (!confirmRemoval) return;

    setIsLoading(true);
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
    } finally {
        setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !pattern.trim()) {
      setError('Name and pattern are required.');
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
    const confirmDeletion = window.confirm("Are you sure you want to delete this regex?");
    if (!confirmDeletion) return;

    try {
      await deleteRegex(regex.id);
      onSave();
      onClose();
    } catch (error) {
      console.error('Error deleting regex:', error);
      setError('Failed to delete regex. Please try again.');
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
        {regex101Link ? (
          <div className="flex items-center space-x-2">
            <a 
              href={regex101Link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 transition-colors"
            >
              View in Regex101
            </a>
            <button
              onClick={handleRemoveRegex101Link}
              className="text-red-500 hover:text-red-600 transition-colors"
              disabled={isLoading}
            >
              {isLoading ? 'Removing...' : 'Remove Link'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCreateRegex101Link}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Tests...' : 'Create Tests in Regex101'}
          </button>
        )}
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description (Optional)
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
      <div className="flex justify-between">
        <button
          onClick={handleDelete}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
        >
          Delete
        </button>
        <button
          onClick={handleSave}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Save
        </button>
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