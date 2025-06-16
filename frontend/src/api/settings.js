// @api/settings.js
import Alert from '@ui/Alert';
const API_PREFIX = '/api';

// Helper function to mark errors that have already been handled
const createHandledError = message => {
    const error = new Error(message);
    error.isHandled = true;
    return error;
};

export const fetchSettings = async () => {
    try {
        const response = await fetch(`${API_PREFIX}/settings`, {
            credentials: 'include'
        });

        const data = await response.json();
        if (!response.ok) {
            const errorMessage = data.error || 'Failed to fetch settings';
            Alert.error(errorMessage);
            throw createHandledError(errorMessage);
        }
        return data;
    } catch (error) {
        if (!error.isHandled) {
            Alert.error(error.message || 'Failed to fetch settings');
        }
        throw error;
    }
};

export const fetchGeneralSettings = async () => {
    try {
        const response = await fetch(`${API_PREFIX}/settings/general`, {
            credentials: 'include'
        });

        const data = await response.json();
        if (!response.ok) {
            const errorMessage =
                data.error || 'Failed to fetch general settings';
            Alert.error(errorMessage);
            throw createHandledError(errorMessage);
        }
        return data;
    } catch (error) {
        if (!error.isHandled) {
            Alert.error(error.message || 'Failed to fetch general settings');
        }
        throw error;
    }
};

export const updateUsername = async (username, currentPassword) => {
    try {
        const response = await fetch(`${API_PREFIX}/settings/username`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({username, current_password: currentPassword})
        });

        const data = await response.json();
        if (!response.ok) {
            const errorMessage = data.error || 'Failed to update username';
            Alert.error(errorMessage);
            throw createHandledError(errorMessage);
        }
        Alert.success('Username updated successfully');
        return data;
    } catch (error) {
        if (!error.isHandled) {
            Alert.error(error.message || 'Failed to update username');
        }
        throw error;
    }
};

export const updatePassword = async (currentPassword, newPassword) => {
    try {
        const response = await fetch(`${API_PREFIX}/settings/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        const data = await response.json();
        if (!response.ok) {
            const errorMessage = data.error || 'Failed to update password';
            Alert.error(errorMessage);
            throw createHandledError(errorMessage);
        }
        Alert.success('Password updated successfully');
        return data;
    } catch (error) {
        if (!error.isHandled) {
            Alert.error(error.message || 'Failed to update password');
        }
        throw error;
    }
};

export const resetApiKey = async currentPassword => {
    try {
        const response = await fetch(`${API_PREFIX}/settings/api-key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({current_password: currentPassword})
        });

        const data = await response.json();
        if (!response.ok) {
            const errorMessage = data.error || 'Failed to reset API key';
            Alert.error(errorMessage);
            throw createHandledError(errorMessage);
        }
        Alert.success('API key reset successfully');
        return data;
    } catch (error) {
        if (!error.isHandled) {
            Alert.error(error.message || 'Failed to reset API key');
        }
        throw error;
    }
};

export const fetchLanguageImportScore = async () => {
    try {
        const response = await fetch(`${API_PREFIX}/settings/language-import-score`, {
            credentials: 'include'
        });

        const data = await response.json();
        if (!response.ok) {
            const errorMessage = data.error || 'Failed to fetch language import score';
            Alert.error(errorMessage);
            throw createHandledError(errorMessage);
        }
        return data;
    } catch (error) {
        if (!error.isHandled) {
            Alert.error(error.message || 'Failed to fetch language import score');
        }
        throw error;
    }
};

export const updateLanguageImportScore = async (score) => {
    try {
        const response = await fetch(`${API_PREFIX}/settings/language-import-score`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({score})
        });

        const data = await response.json();
        if (!response.ok) {
            const errorMessage = data.error || 'Failed to update language import score';
            Alert.error(errorMessage);
            throw createHandledError(errorMessage);
        }
        Alert.success('Language import score updated successfully');
        return data;
    } catch (error) {
        if (!error.isHandled) {
            Alert.error(error.message || 'Failed to update language import score');
        }
        throw error;
    }
};
