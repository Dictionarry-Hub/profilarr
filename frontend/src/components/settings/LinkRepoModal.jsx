import React, {useState} from 'react';
import Modal from '../ui/Modal';
import {Loader} from 'lucide-react';
import {cloneRepo} from '../../api/api';
import Alert from '../ui/Alert';

const LinkRepoModal = ({isOpen, onClose, onSubmit}) => {
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
            Alert.error(
                'An unexpected error occurred while linking the repository.'
            );
            console.error('Error linking repository:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title='Link Git Repository'>
            <div className='space-y-4'>
                <div>
                    <label className='block text-sm font-medium text-gray-300 mb-2'>
                        Git Repository URL:
                    </label>
                    <input
                        type='text'
                        value={gitRepo}
                        onChange={e => setGitRepo(e.target.value)}
                        className='w-full p-2 border rounded bg-gray-900 text-gray-100 border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
                        placeholder='https://github.com/your-repo.git'
                    />
                </div>
                <div className='mt-6 flex justify-end'>
                    <button
                        className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center'
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
                            'Link Repository'
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default LinkRepoModal;
