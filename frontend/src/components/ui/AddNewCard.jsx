import PropTypes from 'prop-types';

function AddNewCard({ onAdd }) {
  return (
    <div
      className="bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl rounded-lg p-4 cursor-pointer border-2 border-dashed border-gray-400 dark:border-gray-600 flex items-center justify-center transition-all duration-300 ease-in-out transform hover:-translate-y-1"
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
