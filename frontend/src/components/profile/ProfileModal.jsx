import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { saveProfile, deleteProfile } from "../../api/api";
import Modal from "../ui/Modal";

function unsanitize(text) {
  return text.replace(/\\:/g, ":").replace(/\\n/g, "\n");
}

function ProfileModal({ profile = null, isOpen, onClose, onSave }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [error, setError] = useState("");
  const initialProfileRef = useRef(profile);

  useEffect(() => {
    if (isOpen) {
      if (profile && profile.id !== 0) {
        initialProfileRef.current = profile;
        setName(unsanitize(profile.name));
        setDescription(unsanitize(profile.description));
        setTags(profile.tags ? profile.tags.map(unsanitize) : []);
      } else {
        initialProfileRef.current = null;
        setName(profile ? unsanitize(profile.name) : "");
        setDescription(profile ? unsanitize(profile.description) : "");
        setTags(profile ? profile.tags.map(unsanitize) : []);
      }
      setError("");
      setNewTag("");
    }
  }, [profile, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    try {
      await saveProfile({
        id: profile ? profile.id : 0,
        name,
        description,
        tags,
      });
      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving profile:", error);
      setError("Failed to save profile. Please try again.");
    }
  };

  const handleDelete = async () => {
    const confirmDeletion = window.confirm(
      "Are you sure you want to delete this profile?"
    );
    if (!confirmDeletion) return;

    try {
      await deleteProfile(profile.id);
      onSave();
      onClose();
    } catch (error) {
      console.error("Error deleting profile:", error);
      setError("Failed to delete profile. Please try again.");
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialProfileRef.current ? "Edit Profile" : "Add Profile"}
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

ProfileModal.propTypes = {
  profile: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default ProfileModal;
