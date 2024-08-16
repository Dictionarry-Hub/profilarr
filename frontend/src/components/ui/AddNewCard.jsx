import PropTypes from 'prop-types';

function AddNewCard({ onAdd }) {
  return (
    <div
      className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg p-4 shadow-sm cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 flex items-center justify-center"
      onClick={onAdd}
      style={{ minHeight: '150px' }}
    >
      <span className="text-4xl text-gray-400 dark:text-gray-500">+</span>
    </div>
  );
}

AddNewCard.propTypes = {
  onAdd: PropTypes.func.isRequired,
};

export default AddNewCard;
