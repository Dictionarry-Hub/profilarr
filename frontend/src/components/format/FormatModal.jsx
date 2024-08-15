import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { saveFormat, deleteFormat, getRegexes } from '../../api/api';
import ConditionModal from '../condition/ConditionModal';
import ConditionCard from '../condition/ConditionCard';
import Modal from '../ui/Modal';

function FormatModal({ format = null, isOpen, onClose, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [conditions, setConditions] = useState([]);
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [regexes, setRegexes] = useState([]);
  const [error, setError] = useState('');
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const initialFormatRef = useRef(format);

  useEffect(() => {
    if (isOpen) {
      initialFormatRef.current = format;
      if (format) {
        setName(format.name);
        setDescription(format.description);
        setConditions(format.conditions || []);
        setTags(format.tags || []);
      } else {
        setName('');
        setDescription('');
        setConditions([]);
        setTags([]);
      }
      setError('');
      setNewTag('');
      fetchRegexes();
    }
  }, [format, isOpen]);

  const fetchRegexes = async () => {
    try {
      const fetchedRegexes = await getRegexes();
      setRegexes(fetchedRegexes);
    } catch (error) {
      console.error('Error fetching regexes:', error);
      setError('Failed to fetch regexes. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || conditions.length === 0) {
      setError('Name, description, and at least one condition are required.');
      return;
    }
    try {
      await saveFormat({ id: initialFormatRef.current ? initialFormatRef.current.id : 0, name, description, conditions, tags });
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving format:', error);
      setError('Failed to save format. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (initialFormatRef.current && initialFormatRef.current.id) {
      try {
        await deleteFormat(initialFormatRef.current.id);
        onSave();
        onClose();
      } catch (error) {
        console.error('Error deleting format:', error);
        setError('Failed to delete format. Please try again.');
      }
    }
  };

  const handleOpenConditionModal = (condition = null) => {
    setSelectedCondition(condition);
    setIsConditionModalOpen(true);
  };

  const handleCloseConditionModal = () => {
    setIsConditionModalOpen(false);
  };

  const handleSaveCondition = (newCondition) => {
    if (selectedCondition) {
      setConditions(conditions.map(c => c === selectedCondition ? newCondition : c));
    } else {
      setConditions([...conditions, newCondition]);
    }
    setIsConditionModalOpen(false);
  };

  const handleDeleteCondition = (conditionToDelete) => {
    setConditions(conditions.filter(c => c !== conditionToDelete));
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
      title={initialFormatRef.current ? 'Edit Custom Format' : 'Add Custom Format'}
      className="max-w-3xl min-h-96"
    >
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Format Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter format name"
          className="w-full p-3 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
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
          className="w-full p-3 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
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
      <h3 className="font-bold mb-4 dark:text-gray-300">Conditions:</h3>
      <div className="mb-6 max-h-96 overflow-y-auto grid grid-cols-1 gap-4">
        {conditions.map((condition, index) => (
          <ConditionCard
            key={index}
            condition={condition}
            onEdit={() => handleOpenConditionModal(condition)}
          />
        ))}
      </div>
      <button
        onClick={() => handleOpenConditionModal()}
        className="bg-green-500 text-white px-4 py-3 rounded hover:bg-green-600 mb-6 transition-colors"
      >
        Add Condition
      </button>
      <div className="flex justify-between">
        <button
          onClick={handleSave}
          className="bg-blue-500 text-white px-4 py-3 rounded hover:bg-blue-600 transition-colors"
        >
          Save
        </button>
        {format && (
          <button
            onClick={handleDelete}
            className="bg-red-500 text-white px-4 py-3 rounded hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
      <ConditionModal
        condition={selectedCondition}
        isOpen={isConditionModalOpen}
        onClose={handleCloseConditionModal}
        onSave={handleSaveCondition}
        onDelete={handleDeleteCondition}
        regexes={regexes}
        level={1}
      />
    </Modal>
  );
}

FormatModal.propTypes = {
  format: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    conditions: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        negate: PropTypes.bool,
        required: PropTypes.bool,
      })
    ).isRequired,
    tags: PropTypes.arrayOf(PropTypes.string),
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default FormatModal;