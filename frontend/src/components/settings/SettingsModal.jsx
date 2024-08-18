import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { Loader } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose, onSave }) => {
    const [gitRepo, setGitRepo] = useState('');
    const [gitToken, setGitToken] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSave = () => {
        if (!gitRepo || !gitToken) {
            alert("Please fill in all fields.");
            return;
        }
        setLoading(true);
        onSave({ gitRepo, gitToken, localRepoPath: 'data/db' })
            .finally(() => setLoading(false));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Setup Git Repository">
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
                        value={gitToken}
                        onChange={(e) => setGitToken(e.target.value)}
                        className="w-full p-2 border rounded bg-gray-900 text-gray-100 border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Your GitHub Token"
                    />
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader size={16} className="animate-spin mr-2" />
                                Saving...
                            </>
                        ) : (
                            'Save'
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default SettingsModal;
