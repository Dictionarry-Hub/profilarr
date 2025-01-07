// @api/auth.js
const API_PREFIX = '/api';

export const checkSetupStatus = async () => {
    try {
        // First try to access settings
        const response = await fetch(`${API_PREFIX}/settings`, {
            credentials: 'include'
        });

        // If settings works, we're already authenticated
        if (response.ok) {
            return {needsSetup: false, needsLogin: false};
        }

        // If unauthorized, check setup status
        if (response.status === 401) {
            const setupResponse = await fetch(`${API_PREFIX}/auth/setup`, {
                method: 'GET',
                credentials: 'include'
            });

            if (setupResponse.ok) {
                // Setup is needed
                return {needsSetup: true, needsLogin: false};
            }

            if (setupResponse.status === 400) {
                // Setup is done but we need to login
                return {needsSetup: false, needsLogin: true};
            }
        }

        throw new Error('Unable to determine setup status');
    } catch (error) {
        console.error('Error checking setup status:', error);
        return {error: 'Unable to connect to server'};
    }
};

export const setupApplication = async (username, password) => {
    try {
        const response = await fetch(`${API_PREFIX}/auth/setup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({username, password})
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Setup failed');
        }

        // Store API key if needed
        if (data.api_key) {
            localStorage.setItem('api_key', data.api_key);
        }

        return data;
    } catch (error) {
        throw new Error(error.message || 'Setup failed');
    }
};

export const login = async (username, password) => {
    try {
        const response = await fetch(`${API_PREFIX}/auth/authenticate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({username, password})
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        return data;
    } catch (error) {
        throw new Error(error.message || 'Login failed');
    }
};

// Utility function to check if we're authenticated
export const checkAuth = async () => {
    try {
        const response = await fetch(`${API_PREFIX}/settings`, {
            credentials: 'include'
        });
        return response.ok;
    } catch (error) {
        return false;
    }
};
