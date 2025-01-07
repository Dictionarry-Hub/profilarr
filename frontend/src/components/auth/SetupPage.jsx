// components/auth/SetupPage.js
import React, {useState} from 'react';
import {setupApplication} from '@api/auth';
import Alert from '@ui/Alert';
import {Info, Shield, KeyRound} from 'lucide-react';

const SetupPage = ({onSetupComplete}) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async e => {
        e.preventDefault();

        if (password !== confirmPassword) {
            Alert.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await setupApplication(username, password);
            Alert.success('Setup completed successfully');
            onSetupComplete();
        } catch (error) {
            Alert.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='min-h-screen flex items-center justify-center bg-gray-900 p-4'>
            <div className='max-w-5xl w-full flex gap-6'>
                {/* Main Setup Card */}
                <div className='bg-gray-800 rounded-lg shadow-xl border border-gray-700 flex-1'>
                    <div className='p-8'>
                        <div className='flex items-center gap-4 mb-6'>
                            <KeyRound className='h-8 w-8 text-blue-500' />
                            <h2 className='text-3xl font-bold text-white'>
                                Initial Setup
                            </h2>
                        </div>

                        <form className='space-y-6' onSubmit={handleSubmit}>
                            <div className='space-y-5'>
                                <div>
                                    <label
                                        htmlFor='username'
                                        className='block text-sm font-medium text-gray-300 mb-1'>
                                        Username
                                    </label>
                                    <input
                                        id='username'
                                        name='username'
                                        type='text'
                                        value={username}
                                        onChange={e =>
                                            setUsername(e.target.value)
                                        }
                                        required
                                        className='appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm'
                                        placeholder='Enter your username'
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor='password'
                                        className='block text-sm font-medium text-gray-300 mb-1'>
                                        Password
                                    </label>
                                    <input
                                        id='password'
                                        name='password'
                                        type='password'
                                        value={password}
                                        onChange={e =>
                                            setPassword(e.target.value)
                                        }
                                        required
                                        className='appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm'
                                        placeholder='Enter your password'
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor='confirm-password'
                                        className='block text-sm font-medium text-gray-300 mb-1'>
                                        Confirm Password
                                    </label>
                                    <input
                                        id='confirm-password'
                                        name='confirm-password'
                                        type='password'
                                        value={confirmPassword}
                                        onChange={e =>
                                            setConfirmPassword(e.target.value)
                                        }
                                        required
                                        className='appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm'
                                        placeholder='Confirm your password'
                                    />
                                </div>
                            </div>

                            <div className='pt-2'>
                                <button
                                    type='submit'
                                    disabled={loading}
                                    className='w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200'>
                                    {loading
                                        ? 'Setting up...'
                                        : 'Complete Setup'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Why Register Card */}
                <div className='w-80 flex-shrink-0'>
                    <div className='bg-blue-900/30 border border-blue-700 rounded-lg p-6 sticky top-4'>
                        <div className='flex items-start gap-3 mb-4'>
                            <Shield className='h-6 w-6 text-blue-400 mt-1 flex-shrink-0' />
                            <h3 className='text-lg font-medium text-blue-400'>
                                Why do I need to register?
                            </h3>
                        </div>
                        <div className='space-y-4 text-sm text-gray-300'>
                            <p>
                                While this app runs locally on your computer,
                                it's important to keep it secure in cases where
                                it becomes accessible from the internet through:
                            </p>
                            <ul className='space-y-2 list-disc list-inside'>
                                <li>Intentional remote access setup</li>
                                <li>Misconfigured network security</li>
                            </ul>
                            <p>
                                Registration ensures that only you can access
                                your application, protecting your data and
                                system even if it becomes externally accessible.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SetupPage;
