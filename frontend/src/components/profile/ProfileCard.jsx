import PropTypes from "prop-types";

function unsanitize(text) {
  return text.replace(/\\:/g, ":").replace(/\\n/g, "\n");
}

function ProfileCard({ profile, onEdit, onClone, showDate, formatDate }) {
  return (
    <div
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-shadow"
      onClick={() => onEdit(profile)}
    >
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">
          {unsanitize(profile.name)}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClone(profile);
          }}
          className="relative group"
        >
          <img
            src="/clone.svg"
            alt="Clone"
            className="w-5 h-5 transition-transform transform group-hover:scale-125 group-hover:rotate-12 group-hover:-translate-y-1 group-hover:translate-x-1"
          />
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
        </button>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 mb-2">
        {unsanitize(profile.description)}
      </p>
      {showDate && (
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">
          Modified: {formatDate(profile.date_modified)}
        </p>
      )}
      <div className="flex flex-wrap">
        {profile.tags &&
          profile.tags.map((tag) => (
            <span
              key={tag}
              className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 mb-1 px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300"
            >
              {tag}
            </span>
          ))}
      </div>
    </div>
  );
}

ProfileCard.propTypes = {
  profile: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    date_modified: PropTypes.string.isRequired,
    tags: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onClone: PropTypes.func.isRequired,
  showDate: PropTypes.bool.isRequired,
  formatDate: PropTypes.func.isRequired,
};

export default ProfileCard;
