import axios from 'axios';

const API_URL = '/api/v2/import';

/**
 * Import formats or profiles to a specified arr instance
 * @param {string|number} arrID - The arr config ID to import to
 * @param {string} strategy - Either 'format' or 'profile'
 * @param {string[]} filenames - Array of file names to import
 * @returns {Promise<Object>} Import results
 */
export const importData = async (arrID, strategy, filenames) => {
    try {
        // Clean filenames - remove .yml extension if present
        const cleanFilenames = filenames.map(name => 
            name.replace('.yml', '')
        );

        const response = await axios.post(API_URL, {
            arrID: parseInt(arrID, 10),
            strategy: strategy,
            filenames: cleanFilenames
        });

        if (!response.data.success) {
            throw new Error(response.data.error || 'Import failed');
        }

        return response.data;
    } catch (error) {
        console.error('Import error:', error);
        throw error.response?.data?.error || error.message || 'Failed to import';
    }
};

export const importFormats = (arrID, formatNames) => 
    importData(arrID, 'format', formatNames);

export const importProfiles = (arrID, profileNames) => 
    importData(arrID, 'profile', profileNames);