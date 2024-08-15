import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from '../ui/Modal';

function ConditionModal({ 
  condition = null, 
  isOpen, 
  onClose, 
  onSave, 
  onDelete = null, 
  regexes, 
  level = 0 
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('regex');
  const [regexName, setRegexName] = useState('');
  const [minSize, setMinSize] = useState('');
  const [maxSize, setMaxSize] = useState('');
  const [flag, setFlag] = useState('');
  const [negate, setNegate] = useState(false);
  const [required, setRequired] = useState(false);
  const [error, setError] = useState('');
  const initialConditionRef = useRef(condition);

  useEffect(() => {
    if (isOpen) {
      initialConditionRef.current = condition;
      if (condition) {
        setName(condition.name);
        if (condition.regex_name) {
          setType('regex');
          setRegexName(condition.regex_name);
        } else if (condition.min !== undefined && condition.max !== undefined) {
          setType('size');
          setMinSize(condition.min);
          setMaxSize(condition.max);
        } else if (condition.flag) {
          setType('flag');
          setFlag(condition.flag);
        }
        setNegate(condition.negate || false);
        setRequired(condition.required || false);
      } else {
        setName('');
        setType('regex');
        setRegexName('');
        setMinSize('');
        setMaxSize('');
        setFlag('');
        setNegate(false);
        setRequired(false);
      }
      setError('');
    }
  }, [condition, isOpen]);

  const handleSave = () => {
    if (!name.trim()) {
      setError('Condition name is required.');
      return;
    }

    if (type === 'regex' && !regexName) {
      setError('Please select a regex pattern.');
      return;
    }

    if (type === 'size' && (!minSize || !maxSize)) {
      setError('Both minimum and maximum sizes are required.');
      return;
    }

    if (type === 'flag' && !flag) {
      setError('Please select a flag.');
      return;
    }

    const newCondition = {
      name,
      negate,
      required,
      ...(type === 'regex' ? { regex_name: regexName } : {}),
      ...(type === 'size' ? { min: parseInt(minSize), max: parseInt(maxSize) } : {}),
      ...(type === 'flag' ? { flag } : {}),
    };
    onSave(newCondition);
    onClose();
  };

  const handleDelete = () => {
    if (initialConditionRef.current) {
      onDelete(initialConditionRef.current);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      level={level}
      title={initialConditionRef.current ? 'Edit Condition' : 'Add Condition'}
      disableCloseOnOutsideClick={true}
      disableCloseOnEscape={true}
      className="max-w-2xl min-h-72"
    >
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Condition Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter condition name"
          className="w-full p-3 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Condition Type
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full p-3 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
        >
          <option value="regex">Regex</option>
          <option value="size">Size</option>
          <option value="flag">Flag</option>
        </select>
      </div>
      {type === 'regex' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Regex Pattern
          </label>
          <select
            value={regexName}
            onChange={(e) => setRegexName(e.target.value)}
            className="w-full p-3 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
          >
            <option value="">Select a regex</option>
            {regexes.map((regex) => (
              <option key={regex.id} value={regex.name}>
                {regex.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {type === 'size' && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Minimum Size (bytes)
            </label>
            <input
              type="number"
              value={minSize}
              onChange={(e) => setMinSize(e.target.value)}
              placeholder="Enter minimum size"
              className="w-full p-3 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Maximum Size (bytes)
            </label>
            <input
              type="number"
              value={maxSize}
              onChange={(e) => setMaxSize(e.target.value)}
              placeholder="Enter maximum size"
              className="w-full p-3 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
            />
          </div>
        </>
      )}
      {type === 'flag' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Flag
          </label>
          <select
            value={flag}
            onChange={(e) => setFlag(e.target.value)}
            className="w-full p-3 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
          >
            <option value="">Select a flag</option>
            <option value="golden-popcorn">Golden Popcorn</option>
            <option value="internal">Internal</option>
            <option value="freeleech">Freeleech</option>
            <option value="halfleech">Halfleech</option>
          </select>
        </div>
      )}
      <div className="mb-4">
        <label className="flex items-center dark:text-gray-300">
          <input
            type="checkbox"
            checked={negate}
            onChange={(e) => setNegate(e.target.checked)}
            className="mr-2"
          />
          Negate (invert the condition)
        </label>
      </div>
      <div className="mb-6">
        <label className="flex items-center dark:text-gray-300">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="mr-2"
          />
          Required (condition must be met)
        </label>
      </div>
      <div className="flex justify-between">
        <button
          onClick={handleSave}
          className="bg-blue-500 text-white px-4 py-3 rounded hover:bg-blue-600 transition-colors"
        >
          Save
        </button>
        {initialConditionRef.current && onDelete && (
          <button
            onClick={handleDelete}
            className="bg-red-500 text-white px-4 py-3 rounded hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </Modal>
  );
}

ConditionModal.propTypes = {
  condition: PropTypes.shape({
    name: PropTypes.string,
    regex_name: PropTypes.string,
    min: PropTypes.number,
    max: PropTypes.number,
    negate: PropTypes.bool,
    required: PropTypes.bool,
    flag: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
  regexes: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
  level: PropTypes.number,
};

export default ConditionModal;