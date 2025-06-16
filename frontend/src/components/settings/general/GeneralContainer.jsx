// settings/general/GeneralContainer.jsx
import React, {useState, useEffect} from 'react';
import {RefreshCw} from 'lucide-react';
import {fetchGeneralSettings} from '@api/settings';
import ApiSettingsContainer from './ApiSettingsContainer';
import UserSettingsContainer from './UserSettingsContainer';
import ImportSettingsContainer from './ImportSettingsContainer';

const GeneralContainer = () => {
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({
        apiKey: '',
        username: ''
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const {username, api_key} = await fetchGeneralSettings();
            setSettings({
                apiKey: api_key,
                username: username
            });
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApiKeyUpdate = newApiKey => {
        setSettings(prev => ({
            ...prev,
            apiKey: newApiKey
        }));
    };

    const handleUsernameUpdate = newUsername => {
        setSettings(prev => ({
            ...prev,
            username: newUsername
        }));
    };

    if (loading) {
        return (
            <div className='flex items-center justify-center h-32'>
                <RefreshCw className='w-6 h-6 animate-spin text-gray-400' />
            </div>
        );
    }

    return (
        <div className='space-y-6'>
            <ApiSettingsContainer 
                apiKey={settings.apiKey}
                onApiKeyUpdate={handleApiKeyUpdate}
            />
            <UserSettingsContainer
                username={settings.username}
                onUsernameUpdate={handleUsernameUpdate}
            />
            <ImportSettingsContainer />
        </div>
    );
};

export default GeneralContainer;
