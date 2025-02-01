// settings/general/GeneralContainer.jsx
import React, {useState, useEffect} from 'react';
import {Eye, EyeOff, Copy, RefreshCw, Check} from 'lucide-react';

const GeneralContainer = () => {
    const [loading, setLoading] = useState(true);
    const [showApiKey, setShowApiKey] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [formData, setFormData] = useState({
        apiKey: '',
        username: '',
        password: '',
        currentUsername: '',
        currentPassword: ''
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            console.log('Fetching general settings');
            setFormData({
                apiKey: 'sk-1234567890abcdef',
                username: 'admin',
                password: 'currentpassword',
                currentUsername: 'admin',
                currentPassword: 'currentpassword'
            });
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyApiKey = async () => {
        await navigator.clipboard.writeText(formData.apiKey);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 1000);
    };

    const handleResetApiKey = () => {
        const confirmed = window.confirm(
            'Are you sure you want to reset your API key? This action cannot be undone and your current key will stop working immediately.'
        );
        if (confirmed) {
            console.log('Will reset API key');
            // Here you would call your API endpoint to reset the key
        }
    };

    const handleUsernameChange = e => {
        setFormData(prev => ({
            ...prev,
            username: e.target.value
        }));
    };

    const handlePasswordChange = e => {
        setFormData(prev => ({
            ...prev,
            password: e.target.value
        }));
    };

    const handleSaveUsername = () => {
        console.log('Will save username:', formData.username);
        setFormData(prev => ({
            ...prev,
            currentUsername: formData.username
        }));
    };

    const handleSavePassword = () => {
        const confirmed = window.confirm(
            'Are you sure you want to change your password?'
        );
        if (confirmed) {
            console.log('Will save password:', formData.password);
            setFormData(prev => ({
                ...prev,
                currentPassword: formData.password
            }));
        }
    };

    if (loading) {
        return (
            <div className='flex items-center justify-center h-32'>
                <RefreshCw className='w-6 h-6 animate-spin text-gray-400' />
            </div>
        );
    }

    const hasUsernameChanges = formData.username !== formData.currentUsername;
    const hasPasswordChanges = formData.password !== formData.currentPassword;

    return (
        <div className='space-y-6'>
            <div className='space-y-4'>
                <h2 className='text-xl font-bold text-gray-100'>
                    API Settings
                </h2>
                <div className='space-y-2'>
                    <label className='text-sm font-medium text-gray-300'>
                        API Key
                    </label>
                    <div className='flex space-x-2'>
                        <div className='relative flex-1'>
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                value={formData.apiKey}
                                readOnly
                                className='w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100'
                            />
                            <button
                                onClick={() => setShowApiKey(!showApiKey)}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 w-6 h-6 flex items-center justify-center'>
                                {showApiKey ? (
                                    <EyeOff size={18} />
                                ) : (
                                    <Eye size={18} />
                                )}
                            </button>
                        </div>
                        <button
                            onClick={handleCopyApiKey}
                            className='w-10 h-10 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-600 flex items-center justify-center'
                            title='Copy API key'>
                            {copySuccess ? (
                                <Check size={18} className='text-green-500' />
                            ) : (
                                <Copy size={18} />
                            )}
                        </button>
                        <button
                            onClick={handleResetApiKey}
                            className='w-10 h-10 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-600 flex items-center justify-center'
                            title='Reset API key - this will invalidate your current key'>
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <div className='space-y-4'>
                <h2 className='text-xl font-bold text-gray-100'>
                    User Settings
                </h2>
                <div className='space-y-4'>
                    <div className='space-y-2'>
                        <label className='text-sm font-medium text-gray-300'>
                            Username
                        </label>
                        <div className='flex space-x-2'>
                            <input
                                type='text'
                                value={formData.username}
                                onChange={handleUsernameChange}
                                className='flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100'
                            />
                            <button
                                onClick={handleSaveUsername}
                                disabled={!hasUsernameChanges}
                                title={
                                    hasUsernameChanges
                                        ? 'Save changes'
                                        : 'No changes to save'
                                }
                                className={`px-4 h-10 bg-gray-800 border rounded-lg flex items-center justify-center ${
                                    hasUsernameChanges
                                        ? 'border-gray-600 hover:bg-gray-600 cursor-pointer'
                                        : 'border-gray-700 text-gray-500 cursor-not-allowed'
                                }`}>
                                Save
                            </button>
                        </div>
                    </div>

                    <div className='space-y-2'>
                        <label className='text-sm font-medium text-gray-300'>
                            Password
                        </label>
                        <div className='flex space-x-2'>
                            <div className='relative flex-1'>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={handlePasswordChange}
                                    className='w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100'
                                />
                                <button
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 w-6 h-6 flex items-center justify-center'>
                                    {showPassword ? (
                                        <EyeOff size={18} />
                                    ) : (
                                        <Eye size={18} />
                                    )}
                                </button>
                            </div>
                            <button
                                onClick={handleSavePassword}
                                disabled={!hasPasswordChanges}
                                title={
                                    hasPasswordChanges
                                        ? 'Save changes'
                                        : 'No changes to save'
                                }
                                className={`px-4 h-10 bg-gray-800 border rounded-lg flex items-center justify-center ${
                                    hasPasswordChanges
                                        ? 'border-gray-600 hover:bg-gray-600 cursor-pointer'
                                        : 'border-gray-700 text-gray-500 cursor-not-allowed'
                                }`}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneralContainer;
