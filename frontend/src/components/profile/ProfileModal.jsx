import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { saveProfile, deleteProfile, getFormats } from "../../api/api";
import Modal from "../ui/Modal";
import Alert from "../ui/Alert";

function unsanitize(text) {
  return text.replace(/\\:/g, ":").replace(/\\n/g, "\n");
}

function ProfileModal({ profile: initialProfile, isOpen, onClose, onSave }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [customFormats, setCustomFormats] = useState([]);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialProfile && initialProfile.id !== 0) {
        setName(unsanitize(initialProfile.name));
        setDescription(unsanitize(initialProfile.description));
        setTags(initialProfile.tags ? initialProfile.tags.map(unsanitize) : []);
        setCustomFormats(initialProfile.custom_formats || []);
      } else {
        setName("");
        setDescription("");
        setTags([]);
        setCustomFormats([]);
      }
      setError("");
      setNewTag("");
      fetchAllFormats();
    }
  }, [initialProfile, isOpen]);

  const fetchAllFormats = async () => {
    try {
      const formats = await getFormats();
      const updatedCustomFormats = formats.map((format) => {
        const existingFormat =
          initialProfile && initialProfile.custom_formats
            ? initialProfile.custom_formats.find((cf) => cf.id === format.id)
            : null;
        return {
          id: format.id,
          name: format.name,
          score: existingFormat ? existingFormat.score : 0,
        };
      });
      setCustomFormats(updatedCustomFormats);
    } catch (error) {
      console.error("Error fetching formats:", error);
      setError("Failed to fetch formats.");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    try {
      await saveProfile({
        id: initialProfile ? initialProfile.id : 0,
        name,
        description,
        tags,
        custom_formats: customFormats,
      });
      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving profile:", error);
      setError("Failed to save profile. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (isDeleting) {
      try {
        console.log("Attempting to delete profile with ID:", initialProfile.id);
        const response = await deleteProfile(initialProfile.id);
        console.log("Delete response:", response);
        if (response.error) {
          Alert.error(`Failed to delete profile: ${response.message}`);
        } else {
          Alert.success("Profile deleted successfully");
          onSave();
          onClose();
        }
      } catch (error) {
        console.error("Error deleting profile:", error);
        Alert.error("Failed to delete profile. Please try again.");
      } finally {
        setIsDeleting(false);
      }
    } else {
      setIsDeleting(true);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleScoreChange = (formatId, score) => {
    setCustomFormats(
      customFormats.map((format) =>
        format.id === formatId
          ? { ...format, score: Math.max(parseInt(score) || 0, 0) }
          : format
      )
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialProfile ? "Edit Profile" : "Add Profile"}
    >
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Profile Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter profile name"
          className="w-full p-2 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter description"
          className="w-full p-2 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
          rows="3"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tags
        </label>
        <div className="flex flex-wrap mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 text-xs"
              >
                &times;
              </button>
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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Custom Formats
        </label>
        <div className="max-h-60 overflow-y-auto">
          {customFormats.map((format) => (
            <div key={format.id} className="flex items-center space-x-2 mb-2">
              <span className="flex-grow">{format.name}</span>
              <input
                type="number"
                value={format.score}
                onChange={(e) => handleScoreChange(format.id, e.target.value)}
                className="w-20 p-1 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                min="0"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between">
        {initialProfile && (
          <button
            onClick={handleDelete}
            className={`bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors ${
              isDeleting ? "bg-red-600" : ""
            }`}
          >
            {isDeleting ? "Confirm Delete" : "Delete"}
          </button>
        )}
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

ProfileModal.propTypes = {
  profile: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    custom_formats: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
        score: PropTypes.number.isRequired,
      })
    ),
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default ProfileModal;
