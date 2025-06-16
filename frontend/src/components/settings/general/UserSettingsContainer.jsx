import React, {useState} from 'react';
import {Eye, EyeOff, Save, Check} from 'lucide-react';
import {updateUsername, updatePassword} from '@api/settings';
import Alert from '@ui/Alert';
import CategoryContainer from './CategoryContainer';

const UserSettingsContainer = ({username, onUsernameUpdate}) => {
    const [formData, setFormData] = useState({
        username: username,
        usernameCurrentPassword: '',
        password: '',
        confirmPassword: '',
        currentPassword: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        password: false,
        confirmPassword: false,
        currentPassword: false,
        usernameCurrentPassword: false
    });
    const [saveSuccess, setSaveSuccess] = useState({
        username: false,
        password: false
    });

    const hasUsernameChanges = formData.username !== username;

    const handleUsernameChange = e => {
        setFormData(prev => ({...prev, username: e.target.value}));
    };

    const handleSaveUsername = async () => {
        try {
            await updateUsername(formData.username, formData.usernameCurrentPassword);
            onUsernameUpdate(formData.username);
            setFormData(prev => ({...prev, usernameCurrentPassword: ''}));
            setSaveSuccess(prev => ({...prev, username: true}));
            setTimeout(() => setSaveSuccess(prev => ({...prev, username: false})), 1000);
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
                } else {
                    setSaveSuccess(prev => ({...prev, password: true}));
                    setTimeout(() => setSaveSuccess(prev => ({...prev, password: false})), 1000);
                    setFormData(prev => ({
                        ...prev,
                        password: '',
                        confirmPassword: '',
                        currentPassword: ''
                    }));
                }
            } catch (error) {
                console.error('Error updating password:', error);
            }
        }
    };

    return (
        <CategoryContainer title='User Settings'>
            <div className='space-y-6'>
                <div className='space-y-2'>
                    <label className='text-sm font-medium text-gray-300'>
                        Username
                    </label>
                    <div className='space-y-2'>
                        <input
                            type='text'
                            value={formData.username}
                            onChange={handleUsernameChange}
                            className='w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 font-mono text-[13px] hover:border-gray-600 hover:bg-gray-900/70 focus:bg-gray-900 focus:border-blue-400 focus:outline-none transition-colors'
                        />

                        {hasUsernameChanges && (
                            <div className='flex gap-2'>
                                <div className='relative flex-1'>
                                    <input
                                        type={showPasswords.usernameCurrentPassword ? 'text' : 'password'}
                                        value={formData.usernameCurrentPassword}
                                        onChange={e => setFormData(prev => ({
                                            ...prev,
                                            usernameCurrentPassword: e.target.value
                                        }))}
                                        placeholder='Enter current password'
                                        className='w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 font-mono text-[13px] placeholder-gray-500 hover:border-gray-600 hover:bg-gray-900/70 focus:bg-gray-900 focus:border-blue-400 focus:outline-none transition-colors'
                                    />
                                    <button
                                        onClick={() => setShowPasswords(prev => ({
                                            ...prev,
                                            usernameCurrentPassword: !prev.usernameCurrentPassword
                                        }))}
                                        className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 w-6 h-6 flex items-center justify-center'>
                                        {showPasswords.usernameCurrentPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>
                                <button
                                    onClick={handleSaveUsername}
                                    disabled={!formData.usernameCurrentPassword}
                                    title={!formData.usernameCurrentPassword ? 'Enter current password' : 'Save changes'}
                                    className={`px-3 py-1.5 bg-gray-700/50 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-200 text-sm flex items-center gap-2 transition-colors ${
                                        !formData.usernameCurrentPassword ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}>
                                    {saveSuccess.username ? (
                                        <Check size={16} className='text-green-500' />
                                    ) : (
                                        <Save size={16} className='text-blue-500' />
                                    )}
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
                        <div className='relative'>
                            <input
                                type={showPasswords.password ? 'text' : 'password'}
                                value={formData.password}
                                onChange={e => setFormData(prev => ({
                                    ...prev,
                                    password: e.target.value
                                }))}
                                placeholder='Enter new password'
                                className='w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 font-mono text-[13px] placeholder-gray-500 hover:border-gray-600 hover:bg-gray-900/70 focus:bg-gray-900 focus:border-blue-400 focus:outline-none transition-colors'
                            />
                            <button
                                onClick={() => setShowPasswords(prev => ({
                                    ...prev,
                                    password: !prev.password
                                }))}
                                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 w-6 h-6 flex items-center justify-center'>
                                {showPasswords.password ? (
                                    <EyeOff size={18} />
                                ) : (
                                    <Eye size={18} />
                                )}
                            </button>
                        </div>

                        {formData.password && (
                            <>
                                <div className='relative'>
                                    <input
                                        type={showPasswords.confirmPassword ? 'text' : 'password'}
                                        value={formData.confirmPassword}
                                        onChange={e => setFormData(prev => ({
                                            ...prev,
                                            confirmPassword: e.target.value
                                        }))}
                                        placeholder='Confirm new password'
                                        className='w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 font-mono text-[13px] placeholder-gray-500 hover:border-gray-600 hover:bg-gray-900/70 focus:bg-gray-900 focus:border-blue-400 focus:outline-none transition-colors'
                                    />
                                    <button
                                        onClick={() => setShowPasswords(prev => ({
                                            ...prev,
                                            confirmPassword: !prev.confirmPassword
                                        }))}
                                        className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 w-6 h-6 flex items-center justify-center'>
                                        {showPasswords.confirmPassword ? (
                                            <EyeOff size={18} />
                                        ) : (
                                            <Eye size={18} />
                                        )}
                                    </button>
                                </div>

                                <div className='flex gap-2'>
                                    <div className='relative flex-1'>
                                        <input
                                            type={showPasswords.currentPassword ? 'text' : 'password'}
                                            value={formData.currentPassword}
                                            onChange={e => setFormData(prev => ({
                                                ...prev,
                                                currentPassword: e.target.value
                                            }))}
                                            placeholder='Enter current password'
                                            className='w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 font-mono text-[13px] placeholder-gray-500 hover:border-gray-600 hover:bg-gray-900/70 focus:bg-gray-900 focus:border-blue-400 focus:outline-none transition-colors'
                                        />
                                        <button
                                            onClick={() => setShowPasswords(prev => ({
                                                ...prev,
                                                currentPassword: !prev.currentPassword
                                            }))}
                                            className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 w-6 h-6 flex items-center justify-center'>
                                            {showPasswords.currentPassword ? (
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
                                            formData.password !== formData.confirmPassword
                                        }
                                        title={
                                            !formData.password
                                                ? 'Enter a new password'
                                                : !formData.confirmPassword
                                                ? 'Confirm your new password'
                                                : !formData.currentPassword
                                                ? 'Enter your current password'
                                                : formData.password !== formData.confirmPassword
                                                ? 'Passwords do not match'
                                                : 'Save new password'
                                        }
                                        className={`px-3 py-1.5 bg-gray-700/50 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-200 text-sm flex items-center gap-2 transition-colors ${
                                            !(formData.password &&
                                            formData.confirmPassword &&
                                            formData.currentPassword &&
                                            formData.password === formData.confirmPassword) ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}>
                                        {saveSuccess.password ? (
                                            <Check size={16} className='text-green-500' />
                                        ) : (
                                            <Save size={16} className='text-blue-500' />
                                        )}
                                        Save
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </CategoryContainer>
    );
};

export default UserSettingsContainer;