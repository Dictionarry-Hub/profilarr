import axios from 'axios';

const BASE_URL = '/api/media-management';

/**
 * Get all media management data for all categories
 * @returns {Promise<Object>} Media management data organized by arr type
 */
export const getMediaManagementData = async () => {
    try {
        const response = await axios.get(BASE_URL);
        return response.data;
    } catch (error) {
        console.error('Error fetching media management data:', error);
        throw error;
    }
};

/**
 * Get media management data for a specific category
 * @param {string} category - The category to fetch (misc, naming, quality_definitions)
 * @returns {Promise<Object>} Category data
 */
export const getMediaManagementCategory = async (category) => {
    try {
        const response = await axios.get(`${BASE_URL}/${category}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${category} data:`, error);
        throw error;
    }
};

/**
 * Update media management data for a specific category
 * @param {string} category - The category to update (misc, naming, quality_definitions)
 * @param {Object} data - The data to save
 * @returns {Promise<Object>} Updated category data
 */
export const updateMediaManagementCategory = async (category, data) => {
    try {
        const response = await axios.put(`${BASE_URL}/${category}`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating ${category}:`, error);
        throw error;
    }
};

// Organized export pattern for convenience
export const MediaManagement = {
    // Main operations
    getAll: getMediaManagementData,
    getCategory: getMediaManagementCategory,
    updateCategory: updateMediaManagementCategory,
    
    // Category-specific helpers
    getMisc: () => getMediaManagementCategory('misc'),
    getNaming: () => getMediaManagementCategory('naming'),
    getQualityDefinitions: () => getMediaManagementCategory('quality_definitions'),
    
    updateMisc: (data) => updateMediaManagementCategory('misc', data),
    updateNaming: (data) => updateMediaManagementCategory('naming', data),
    updateQualityDefinitions: (data) => updateMediaManagementCategory('quality_definitions', data)
};