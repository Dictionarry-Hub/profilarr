// settings/general/GeneralContainer.jsx
import React, {useState, useEffect} from 'react';
import {Eye, EyeOff, Copy, RefreshCw, Check} from 'lucide-react';
import {
    fetchGeneralSettings,
    updateUsername,
    updatePassword,
    resetApiKey
} from '@api/settings';
import Alert from '@ui/Alert';

const GeneralContainer = () => {
    const [loading, setLoading] = useState(true);
    const [showApiKey, setShowApiKey] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showUsernameCurrentPassword, setShowUsernameCurrentPassword] =
        useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [formData, setFormData] = useState({
        apiKey: '',
        username: '',
        usernameCurrentPassword: '',
        password: '',
        confirmPassword: '',
        currentPassword: '',
        currentUsername: ''
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const {username, api_key} = await fetchGeneralSettings();
            setFormData(prev => ({
                ...prev,
                apiKey: api_key,
                username: username,
                currentUsername: username,
                usernameCurrentPassword: '',
                password: '',
                confirmPassword: '',
                currentPassword: ''
            }));
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

    const handleResetApiKey = async () => {
        const confirmed = window.confirm(
            'Are you sure you want to reset your API key? This action cannot be undone and your current key will stop working immediately.'
        );

        if (confirmed) {
            try {
                const response = await resetApiKey(formData.currentPassword);
                setFormData(prev => ({
                    ...prev,
                    apiKey: response.api_key
                }));
            } catch (error) {
                console.error('Error resetting API key:', error);
            }
        }
    };

    const handleUsernameChange = e => {
        setFormData(prev => ({
            ...prev,
            username: e.target.value
        }));
    };

    const handleUsernameCurrentPasswordChange = e => {
        setFormData(prev => ({
            ...prev,
            usernameCurrentPassword: e.target.value
        }));
    };

    const handlePasswordChange = e => {
        const newPassword = e.target.value;
        setFormData(prev => ({
            ...prev,
            password: newPassword
        }));
    };

    const handleConfirmPasswordChange = e => {
        setFormData(prev => ({
            ...prev,
            confirmPassword: e.target.value
        }));
    };

    const handleCurrentPasswordChange = e => {
        setFormData(prev => ({
            ...prev,
            currentPassword: e.target.value
        }));
    };

    const handleSaveUsername = async () => {
        try {
            await updateUsername(
                formData.username,
                formData.usernameCurrentPassword
            );
            setFormData(prev => ({
                ...prev,
                currentUsername: formData.username,
                usernameCurrentPassword: ''
            }));
        } catch (error) {
            console.error('Error updating username:', error);
        }
    };

    const handleSavePassword = async () => {
        if (formData.password !== formData.confirmPassword) {
            Alert.error('Passwords do not match');
            return;
        }

        const confirmed = window.confirm(
            'Are you sure you want to change your password? You will need to log in again.'
        );

        if (confirmed) {
            try {
                const response = await updatePassword(
                    formData.currentPassword,
                    formData.password
                );

                if (response.requireRelogin) {
                    window.location.href = '/login';
                }
            } catch (error) {
                console.error('Error updating password:', error);
            }
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
                        <div className='space-y-2'>
                            <div className='flex space-x-2'>
                                <input
                                    type='text'
                                    value={formData.username}
                                    onChange={handleUsernameChange}
                                    className='flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100'
                                />
                            </div>

                            {hasUsernameChanges && (
                                <div className='flex gap-2'>
                                    <div className='relative flex-1'>
                                        <input
                                            type={
                                                showUsernameCurrentPassword
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            value={
                                                formData.usernameCurrentPassword
                                            }
                                            onChange={
                                                handleUsernameCurrentPasswordChange
                                            }
                                            placeholder='Enter current password'
                                            className='w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100'
                                        />
                                        <button
                                            onClick={() =>
                                                setShowUsernameCurrentPassword(
                                                    !showUsernameCurrentPassword
                                                )
                                            }
                                            className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 w-6 h-6 flex items-center justify-center'>
                                            {showUsernameCurrentPassword ? (
                                                <EyeOff size={18} />
                                            ) : (
                                                <Eye size={18} />
                                            )}
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleSaveUsername}
                                        disabled={
                                            !formData.usernameCurrentPassword
                                        }
                                        title={
                                            !formData.usernameCurrentPassword
                                                ? 'Enter current password'
                                                : 'Save changes'
                                        }
                                        className={`px-4 h-10 bg-gray-800 border rounded-lg flex items-center justify-center ${
                                            formData.usernameCurrentPassword
                                                ? 'border-gray-600 hover:bg-gray-600 cursor-pointer'
                                                : 'border-gray-700 text-gray-500 cursor-not-allowed'
                                        }`}>
                                        Save
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className='space-y-2'>
                        <label className='text-sm font-medium text-gray-300'>
                            Password
                        </label>
                        <div className='space-y-2'>
                            <div className='relative flex-1'>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={handlePasswordChange}
                                    placeholder='Enter new password'
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

                            {formData.password && (
                                <>
                                    <div className='relative flex-1'>
                                        <input
                                            type={
                                                showConfirmPassword
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            value={formData.confirmPassword}
                                            onChange={
                                                handleConfirmPasswordChange
                                            }
                                            placeholder='Confirm new password'
                                            className='w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100'
                                        />
                                        <button
                                            onClick={() =>
                                                setShowConfirmPassword(
                                                    !showConfirmPassword
                                                )
                                            }
                                            className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 w-6 h-6 flex items-center justify-center'>
                                            {showConfirmPassword ? (
                                                <EyeOff size={18} />
                                            ) : (
                                                <Eye size={18} />
                                            )}
                                        </button>
                                    </div>

                                    <div className='flex gap-2'>
                                        <div className='relative flex-1'>
                                            <input
                                                type={
                                                    showCurrentPassword
                                                        ? 'text'
                                                        : 'password'
                                                }
                                                value={formData.currentPassword}
                                                onChange={
                                                    handleCurrentPasswordChange
                                                }
                                                placeholder='Enter current password'
                                                className='w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100'
                                            />
                                            <button
                                                onClick={() =>
                                                    setShowCurrentPassword(
                                                        !showCurrentPassword
                                                    )
                                                }
                                                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 w-6 h-6 flex items-center justify-center'>
                                                {showCurrentPassword ? (
                                                    <EyeOff size={18} />
                                                ) : (
                                                    <Eye size={18} />
                                                )}
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleSavePassword}
                                            disabled={
                                                !formData.password ||
                                                !formData.confirmPassword ||
                                                !formData.currentPassword ||
                                                formData.password !==
                                                    formData.confirmPassword
                                            }
                                            title={
                                                !formData.password
                                                    ? 'Enter a new password'
                                                    : !formData.confirmPassword
                                                    ? 'Confirm your new password'
                                                    : !formData.currentPassword
                                                    ? 'Enter your current password'
                                                    : formData.password !==
                                                      formData.confirmPassword
                                                    ? 'Passwords do not match'
                                                    : 'Save new password'
                                            }
                                            className={`px-4 h-10 bg-gray-800 border rounded-lg flex items-center justify-center ${
                                                formData.password &&
                                                formData.confirmPassword &&
                                                formData.currentPassword &&
                                                formData.password ===
                                                    formData.confirmPassword
                                                    ? 'border-gray-600 hover:bg-gray-600 cursor-pointer'
                                                    : 'border-gray-700 text-gray-500 cursor-not-allowed'
                                            }`}>
                                            Save
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneralContainer;
