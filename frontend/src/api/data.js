import axios from 'axios';

const BASE_URL = '/api/data';

const handleError = (error, operation) => {
    console.error(`Error ${operation}:`, error);
    if (error.response?.data) {
        return {
            success: false,
            message: error.response.data.error
        };
    }
    return {
        success: false,
        message: `Failed to ${operation}`
    };
};

// Get all items for a category
export const getAllItems = async category => {
    try {
        const response = await axios.get(`${BASE_URL}/${category}`);
        return response.data;
    } catch (error) {
        return handleError(error, `fetch ${category} items`);
    }
};

// Get single item
export const getItem = async (category, name) => {
    try {
        const response = await axios.get(`${BASE_URL}/${category}/${name}`);
        return response.data;
    } catch (error) {
        return handleError(error, `fetch ${category} item ${name}`);
    }
};

// Create new item
export const createItem = async (category, data) => {
    try {
        const response = await axios.post(
            `${BASE_URL}/${category}/${data.name}`,
            data
        );
        return response.data;
    } catch (error) {
        return handleError(error, `create ${category} item`);
    }
};

// Update existing item
export const updateItem = async (category, name, data, newName) => {
    try {
        const response = await axios.put(`${BASE_URL}/${category}/${name}`, {
            ...data,
            ...(newName && {rename: newName}) // Only add rename field if newName exists
        });
        return response.data;
    } catch (error) {
        return handleError(error, `update ${category} item ${name}`);
    }
};

// Delete item
export const deleteItem = async (category, name) => {
    try {
        const response = await axios.delete(`${BASE_URL}/${category}/${name}`);
        return response.data;
    } catch (error) {
        return handleError(error, `delete ${category} item ${name}`);
    }
};

export const Profiles = {
    getAll: () => getAllItems('profile'),
    get: name => getItem('profile', name),
    create: data => createItem('profile', data),
    update: (name, data, newName) => updateItem('profile', name, data, newName),
    delete: name => deleteItem('profile', name)
};

export const CustomFormats = {
    getAll: () => getAllItems('custom_format'),
    get: name => getItem('custom_format', name),
    create: data => createItem('custom_format', data),
    update: (name, data) => updateItem('custom_format', name, data),
    delete: name => deleteItem('custom_format', name)
};

export const RegexPatterns = {
    getAll: () => getAllItems('regex_pattern'),
    get: name => getItem('regex_pattern', name),
    create: data => createItem('regex_pattern', data),
    update: (name, data) => updateItem('regex_pattern', name, data),
    delete: name => deleteItem('regex_pattern', name)
};
