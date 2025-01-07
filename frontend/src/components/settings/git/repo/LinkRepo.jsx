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
            Alert.error(
                'An unexpected error occurred while linking the repository.'
            );
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
