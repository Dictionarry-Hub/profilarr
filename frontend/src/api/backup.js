// @api/backup.js
const API_PREFIX = '/api';

// List all backups
export const listBackups = async () => {
    try {
        const response = await fetch(`${API_PREFIX}/backup`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch backups');
        }

        return await response.json();
    } catch (error) {
        console.error('Error listing backups:', error);
        throw error;
    }
};

// Create a new backup
export const createBackup = async () => {
    try {
        const response = await fetch(`${API_PREFIX}/backup`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to create backup');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating backup:', error);
        throw error;
    }
};

// Download a specific backup
export const downloadBackup = async filename => {
    try {
        const response = await fetch(`${API_PREFIX}/backup/${filename}`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to download backup');
        }

        return response.blob();
    } catch (error) {
        console.error('Error downloading backup:', error);
        throw error;
    }
};

// Restore from a specific backup
export const restoreBackup = async filename => {
    try {
        const response = await fetch(
            `${API_PREFIX}/backup/${filename}/restore`,
            {
                method: 'POST',
                credentials: 'include'
            }
        );

        if (!response.ok) {
            throw new Error('Failed to restore backup');
        }

        return await response.json();
    } catch (error) {
        console.error('Error restoring backup:', error);
        throw error;
    }
};

// Delete a specific backup
export const deleteBackup = async filename => {
    try {
        const response = await fetch(`${API_PREFIX}/backup/${filename}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to delete backup');
        }

        return await response.json();
    } catch (error) {
        console.error('Error deleting backup:', error);
        throw error;
    }
};

// Import and restore from an uploaded backup file
export const importBackup = async file => {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_PREFIX}/backup/import`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to import and restore backup');
        }

        return await response.json();
    } catch (error) {
        console.error('Error importing and restoring backup:', error);
        throw error;
    }
};
