import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

export const getRegexes = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/regex`);
        return response.data;
    } catch (error) {
        console.error('Error fetching regexes:', error);
        throw error;
    }
};

export const saveRegex = async (regex) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/regex`, regex);
        return response.data;
    } catch (error) {
        console.error('Error saving regex:', error);
        throw error;
    }
};

export const updateRegex = async (id, regex) => {
    try {
        const response = await axios.put(`${API_BASE_URL}/regex/${id}`, regex);
        return response.data;
    } catch (error) {
        console.error('Error updating regex:', error);
        throw error;
    }
};

export const deleteRegex = async (id) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/regex/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting regex:', error);
        throw error;
    }
};

export const getFormats = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/format`);
        return response.data;
    } catch (error) {
        console.error('Error fetching formats:', error);
        throw error;
    }
};

export const saveFormat = async (format) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/format`, format);
        return response.data;
    } catch (error) {
        console.error('Error saving format:', error);
        throw error;
    }
};

export const updateFormat = async (id, format) => {
    try {
        const response = await axios.put(`${API_BASE_URL}/format/${id}`, format);
        return response.data;
    } catch (error) {
        console.error('Error updating format:', error);
        throw error;
    }
};

export const deleteFormat = async (id) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/format/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting format:', error);
        throw error;
    }
};

export const createRegex101Link = async (regexData) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/regex/regex101`, regexData);
        return response.data;
    } catch (error) {
        console.error('Error creating regex101 link:', error);
        throw error;
    }
};
