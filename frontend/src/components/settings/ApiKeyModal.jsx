import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { Loader } from 'lucide-react';
import { cloneRepo } from '../../api/api';
import Alert from '../ui/Alert';

const ApiKeyModal = ({ isOpen, onClose, onSubmit }) => {
    const [gitRepo, setGitRepo] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
      if (!gitRepo || !apiKey) {
        Alert.error("Please fill in all fields.");
        return;
      }
      setLoading(true);
      try {
        const response = await cloneRepo(gitRepo, apiKey);
        Alert.success(response.message || "Repository cloned successfully!");
        onSubmit();
      } catch (error) {
        Alert.error("An unexpected error occurred while cloning the repository.");
        console.error("Error cloning repository:", error);
      } finally {
        setLoading(false);
      }
    };    

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Link Git Repository">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Git Repository URL:</label>
                    <input
                        type="text"
                        value={gitRepo}
                        onChange={(e) => setGitRepo(e.target.value)}
                        className="w-full p-2 border rounded bg-gray-900 text-gray-100 border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://github.com/your-repo.git"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">GitHub Access Token:</label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full p-2 border rounded bg-gray-900 text-gray-100 border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Your GitHub Token"
                    />
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center"
                        disabled={loading}
                        onClick={handleSubmit}
                    >
                        {loading ? (
                            <>
                                <Loader size={16} className="animate-spin mr-2" />
                                Cloning...
                            </>
                        ) : (
                            'Clone Repository'
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ApiKeyModal;