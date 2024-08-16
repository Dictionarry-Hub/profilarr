import PropTypes from 'prop-types';

function ConditionCard({ condition, onEdit }) {
  return (
    <div
      onClick={() => onEdit(condition)}
      className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-shadow"
    >
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-bold text-md dark:text-gray-200">{condition.name}</h4>
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {condition.type.charAt(0).toUpperCase() + condition.type.slice(1)}
        </span>
      </div>
      {condition.type === 'regex' && (
        <div className="bg-gray-100 dark:bg-gray-600 rounded p-2 mb-2">
          <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            Regex ID: {condition.regex_id || condition.id}  {/* Display regex_id */}
          </pre>
        </div>
      )}
      {condition.type === 'size' && (
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
          Size: {condition.min || 'Any'} - {condition.max || 'Any'} bytes
        </p>
      )}
      {condition.type === 'flag' && (
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
          Flag: {condition.flag}
        </p>
      )}
      <div className="flex space-x-2 mt-2">
        <span className={`text-xs font-semibold inline-block py-1 px-2 rounded ${condition.required ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}>
          {condition.required ? 'Required' : 'Optional'}
        </span>
        {condition.negate && (
          <span className="text-xs font-semibold inline-block py-1 px-2 rounded bg-red-500 text-white">
            Negated
          </span>
        )}
      </div>
    </div>
  );
}

ConditionCard.propTypes = {
  condition: PropTypes.shape({
    type: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    regex_id: PropTypes.number, // Updated to regex_id
    min: PropTypes.number,
    max: PropTypes.number,
    flag: PropTypes.string,
    negate: PropTypes.bool,
    required: PropTypes.bool,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
};

export default ConditionCard;
