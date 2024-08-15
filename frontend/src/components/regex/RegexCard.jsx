import PropTypes from 'prop-types';

function RegexCard({ regex, onEdit, showDate, formatDate }) {
  return (
    <div
      className="bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl rounded-lg p-4 cursor-pointer border border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out transform hover:-translate-y-1"
      onClick={() => onEdit(regex)}
    >
      <h3 className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-200 truncate">
        {regex.name}
      </h3>
      <div className="bg-gray-100 dark:bg-gray-700 rounded p-2 mb-2">
        <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {regex.pattern}
        </pre>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">
        {regex.description}
      </p>
      {showDate && (
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">
          Modified: {formatDate(regex.date_modified)}
        </p>
      )}
      <div className="flex flex-wrap">
        {regex.tags && regex.tags.map(tag => (
          <span key={tag} className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 mb-1 px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

RegexCard.propTypes = {
  regex: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    pattern: PropTypes.string.isRequired,
    description: PropTypes.string,
    date_modified: PropTypes.string.isRequired,
    tags: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  showDate: PropTypes.bool.isRequired,
  formatDate: PropTypes.func.isRequired,
};

export default RegexCard;