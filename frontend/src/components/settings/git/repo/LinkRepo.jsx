import React, {useState} from 'react';
import Modal from '@ui/Modal';
import {Loader} from 'lucide-react';
import {cloneRepo} from '@api/api';
import Alert from '@ui/Alert';

const LinkRepo = ({isOpen, onClose, onSubmit}) => {
    const [gitRepo, setGitRepo] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!gitRepo) {
            Alert.error('Please enter a repository URL.');
            return;
        }
        setLoading(true);
        try {
            const response = await cloneRepo(gitRepo);
            Alert.success(
                response.message || 'Repository linked successfully!'
            );
            onSubmit();
        } catch (error) {
            // Check for specific error cases
            if (error.response) {
                const { status, data } = error.response;
                
                if (data && data.error) {
                    // Authentication errors for private repos
                    if (data.error.includes("could not read Username") || 
                        data.error.includes("Authentication failed") ||
                        data.error.includes("authentication") ||
                        data.error.includes("PROFILARR_PAT")) {
                        Alert.error(
                            'Authentication failed. Please ensure you have configured a valid GitHub Personal Access Token in your .env file (PROFILARR_PAT).'
                        );
                    } 
                    // Repository not found
                    else if (data.error.includes("not found") || status === 404) {
                        Alert.error(
                            'Repository not found. Please check the URL and ensure you have access to this repository.'
                        );
                    }
                    // Permission issues (general 403)
                    else if (data.error.includes("permission") || 
                             data.error.includes("error: 403") || 
                             status === 403) {
                        Alert.error(
                            'Permission denied. Your GitHub token may not have sufficient permissions to access this repository. Ensure it has "Contents: Read & write" permission.'
                        );
                    }
                    // Write access issues - specifically check for this common error
                    else if (data.error.includes("remote: Write access to repository not granted")) {
                        Alert.error(
                            'Your GitHub token does not have write access to this repository. Please update your token with the "Contents: Read & write" permission.'
                        );
                    }
                    // Any other error - use a generic message rather than showing the raw error
                    else {
                        Alert.error(
                            'Failed to link repository. Please check the URL and your GitHub token permissions.'
                        );
                    }
                } else {
                    // HTTP error without specific message
                    Alert.error(`Failed to link repository (Error ${status})`);
                }
            } else {
                // Network or other errors
                Alert.error(
                    'Failed to connect to the server. Please check your network connection.'
                );
            }
            console.error('Error linking repository:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title='Link Git Repository'
            width='2xl'
            footer={
                <div className='flex justify-end'>
                    <button
                        className='bg-blue-600 text-white px-4 py-2 rounded border border-blue-600 hover:bg-blue-700 transition-colors flex items-center text-sm'
                        disabled={loading}
                        onClick={handleSubmit}>
                        {loading ? (
                            <>
                                <Loader
                                    size={16}
                                    className='animate-spin mr-2'
                                />
                                Linking...
                            </>
                        ) : (
                            'Link'
                        )}
                    </button>
                </div>
            }>
            <div className='space-y-2'>
                <input
                    type='text'
                    value={gitRepo}
                    onChange={e => setGitRepo(e.target.value)}
                    className='w-full px-3 py-2 text-sm rounded
                        border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-700 
                        text-gray-900 dark:text-white
                        focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                        placeholder-gray-400 dark:placeholder-gray-500'
                    placeholder='https://github.com/your-repo'
                />
            </div>
        </Modal>
    );
};

export default LinkRepo;
