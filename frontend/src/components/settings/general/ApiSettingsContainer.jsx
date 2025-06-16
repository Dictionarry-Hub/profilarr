import React, {useState} from 'react';
import {Eye, EyeOff, Copy, RefreshCw, Check} from 'lucide-react';
import {resetApiKey} from '@api/settings';
import Alert from '@ui/Alert';
import CategoryContainer from './CategoryContainer';

const ApiSettingsContainer = ({apiKey, onApiKeyUpdate}) => {
    const [showApiKey, setShowApiKey] = useState(false);
    const [showApiKeyCurrentPassword, setShowApiKeyCurrentPassword] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [apiKeyCurrentPassword, setApiKeyCurrentPassword] = useState('');

    const handleCopyApiKey = async () => {
        await navigator.clipboard.writeText(apiKey);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 1000);
    };

    const handleResetApiKey = async () => {
        if (!apiKeyCurrentPassword) {
            Alert.error('Please enter your current password to reset the API key.');
            return;
        }

        const confirmed = window.confirm(
            'Are you sure you want to reset your API key? This action cannot be undone and your current key will stop working immediately.'
        );

        if (confirmed) {
            try {
                const response = await resetApiKey(apiKeyCurrentPassword);
                onApiKeyUpdate(response.api_key);
                setApiKeyCurrentPassword('');
            } catch (error) {
                console.error('Error resetting API key:', error);
            }
        }
    };

    return (
        <CategoryContainer title='API Settings'>
            <div className='space-y-4'>
                <div className='space-y-2'>
                    <label className='text-sm font-medium text-gray-300'>
                        API Key
                    </label>
                    <div className='flex space-x-2'>
                        <div className='relative flex-1'>
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                value={apiKey}
                                readOnly
                                className='w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 font-mono text-[13px] hover:border-gray-600 hover:bg-gray-900/70 focus:bg-gray-900 focus:border-blue-400 focus:outline-none transition-colors'
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
                            className='px-3 py-2.5 bg-gray-700/50 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-200 flex items-center justify-center transition-colors'
                            title='Copy API key'>
                            {copySuccess ? (
                                <Check size={18} className='text-green-500' />
                            ) : (
                                <Copy size={18} className='text-white' />
                            )}
                        </button>
                        <button
                            onClick={handleResetApiKey}
                            className='px-3 py-2.5 bg-gray-700/50 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-200 flex items-center justify-center transition-colors'
                            title='Reset API key - this will invalidate your current key'>
                            <RefreshCw size={18} className='text-white' />
                        </button>
                    </div>

                    <div className='relative'>
                        <input
                            type={showApiKeyCurrentPassword ? 'text' : 'password'}
                            value={apiKeyCurrentPassword}
                            onChange={e => setApiKeyCurrentPassword(e.target.value)}
                            placeholder='Enter current password to reset API key'
                            className='w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-gray-200 font-mono text-[13px] placeholder-gray-500 hover:border-gray-600 hover:bg-gray-900/70 focus:bg-gray-900 focus:border-blue-400 focus:outline-none transition-colors'
                        />
                        <button
                            onClick={() =>
                                setShowApiKeyCurrentPassword(!showApiKeyCurrentPassword)
                            }
                            className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 w-6 h-6 flex items-center justify-center'>
                            {showApiKeyCurrentPassword ? (
                                <EyeOff size={18} />
                            ) : (
                                <Eye size={18} />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </CategoryContainer>
    );
};

export default ApiSettingsContainer;