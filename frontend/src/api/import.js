import axios from 'axios';

const IMPORT_BASE_URL = '/api/import';

/**
 * Import multiple formats to a specified arr instance
 * @param {string|number} arr - The arr ID to import to
 * @param {string[]} formatNames - Array of format file names to import
 * @param {boolean} [all] - Whether to import all formats
 * @returns {Promise<void>}
 */
export const importFormats = async (arr, formatNames, all = false) => {
    try {
        // Clean up format names by removing .yml if present
        const cleanFormatNames = formatNames.map(name =>
            name.endsWith('.yml') ? name.slice(0, -4) : name
        );

        const response = await axios.post(`${IMPORT_BASE_URL}/format`, {
            arrId: parseInt(arr, 10),
            formatNames: cleanFormatNames,
            all
        });

        if (!response.data.success) {
            throw new Error(
                response.data.message || 'Failed to import formats'
            );
        }

        return response.data;
    } catch (error) {
        console.error('Error importing formats:', error);
        throw (
            error.response?.data?.message ||
            error.message ||
            'Failed to import formats'
        );
    }
};

/**
 * Import multiple profiles to a specified arr instance
 * @param {string|number} arr - The arr ID to import to
 * @param {string[]} profileNames - Array of profile file names to import
 * @param {boolean} [all] - Whether to import all profiles
 * @returns {Promise<void>}
 */
export const importProfiles = async (arr, profileNames, all = false) => {
    try {
        // Clean up profile names by removing .yml if present
        const cleanProfileNames = profileNames.map(name =>
            name.endsWith('.yml') ? name.slice(0, -4) : name
        );

        const response = await axios.post(`${IMPORT_BASE_URL}/profile`, {
            arrId: parseInt(arr, 10),
            profileNames: cleanProfileNames,
            all
        });

        if (!response.data.success) {
            throw new Error(
                response.data.message || 'Failed to import profiles'
            );
        }

        return response.data;
    } catch (error) {
        console.error('Error importing profiles:', error);
        throw (
            error.response?.data?.message ||
            error.message ||
            'Failed to import profiles'
        );
    }
};
