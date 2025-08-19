import React, {useState} from 'react';
import Modal from '@ui/Modal';
import {Loader, GitBranch, Link} from 'lucide-react';
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
            width='2xl'>
            <div className='flex items-center py-2'>
                <div className='relative flex-1'>
                    <input
                        type='text'
                        value={gitRepo}
                        onChange={e => setGitRepo(e.target.value)}
                        className='w-full pl-10 pr-3 py-2 text-sm rounded-l-lg rounded-r-none
                            border border-r-0 border-gray-300 dark:border-gray-600
                            bg-white dark:bg-gray-700 
                            text-gray-900 dark:text-white
                            focus:outline-none focus:border-gray-400 dark:focus:border-gray-500
                            placeholder-gray-400 dark:placeholder-gray-500 transition-colors'
                        placeholder='https://github.com/your-repo'
                    />
                    <GitBranch className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500' size={18} />
                </div>
                <button
                    className='inline-flex items-center gap-2 px-4 py-2 text-sm rounded-l-none rounded-r-lg bg-gray-800 border border-gray-700 text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group'
                    disabled={loading}
                    onClick={handleSubmit}>
                    {loading ? (
                        <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                        <Link className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    )}
                    <span>{loading ? 'Linking...' : 'Link'}</span>
                </button>
            </div>
        </Modal>
    );
};

export default LinkRepo;
