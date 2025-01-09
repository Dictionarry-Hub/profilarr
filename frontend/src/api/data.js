import axios from 'axios';

const BASE_URL = '/api/data';

// Define all special endpoints that could conflict with resource names
const SPECIAL_ENDPOINTS = [
    'test',
    'validate',
    'search',
    'batch',
    'export',
    'import',
    'stats',
    'metrics',
    'health',
    'status',
    'config',
    'settings',
    'logs',
    'audit',
    'backup',
    'restore',
    'sync',
    'preview',
    'publish',
    'deploy',
    'run',
    'execute',
    'process',
    'analyze',
    'verify',
    'check'
];

// Define characters and patterns that could cause routing issues
const UNSAFE_PATTERNS = [
    /[\/\\]/, // No slashes (forward or backward)
    /[\s]/, // No whitespace
    /[<>:"|?*]/, // No special characters that might be interpreted by the system
    /^\.+/, // No dots at start (prevent relative paths)
    /\.+$/, // No dots at end
    /^-/, // No dash at start
    /-$/, // No dash at end
    /--|__|\.\./ // No double separators
];

// Comprehensive name validation
const validateResourceName = (category, name) => {
    // Basic checks
    if (!name || typeof name !== 'string') {
        throw new Error('Resource name must be a non-empty string');
    }

    // Length check
    if (name.length < 1 || name.length > 64) {
        throw new Error('Resource name must be between 1 and 64 characters');
    }

    // Check for special endpoints
    if (SPECIAL_ENDPOINTS.includes(name.toLowerCase())) {
        throw new Error(
            `'${name}' is a reserved word and cannot be used as a resource name`
        );
    }

    // Check for unsafe patterns
    for (const pattern of UNSAFE_PATTERNS) {
        if (pattern.test(name)) {
            throw new Error(
                'Resource name contains invalid characters or patterns'
            );
        }
    }

    // Only allow alphanumeric characters, single hyphens, and underscores
    const validNamePattern = /^[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*$/;
    if (!validNamePattern.test(name)) {
        throw new Error(
            'Resource name must contain only letters, numbers, hyphens, and underscores, and cannot have consecutive separators'
        );
    }

    return true;
};

// Validate entire path to protect against path traversal
const validatePath = parts => {
    if (!Array.isArray(parts)) {
        throw new Error('Path must be an array of segments');
    }

    const joinedPath = parts.join('/');

    // Prevent any path traversal attempts
    if (
        joinedPath.includes('..') ||
        joinedPath.includes('./') ||
        joinedPath.includes('/.')
    ) {
        throw new Error('Invalid path detected');
    }

    // Ensure path doesn't start or end with separators
    if (joinedPath.startsWith('/') || joinedPath.endsWith('/')) {
        throw new Error('Path cannot start or end with separators');
    }

    return true;
};

const handleError = (error, operation) => {
    console.error(`Error ${operation}:`, error);

    // If it's already an Error object with a message, throw it directly
    if (error instanceof Error) {
        throw error;
    }

    // If it's an axios error with a response
    if (error.response?.data) {
        const errorData = error.response.data;
        // Handle various error response formats
        const message =
            errorData.error ||
            errorData.message ||
            errorData.detail ||
            (typeof errorData === 'string' ? errorData : null);

        if (message) {
            throw new Error(message);
        }
    }

    // Fallback generic error
    throw new Error(`Failed to ${operation}`);
};

// Get all items for a category
export const getAllItems = async category => {
    try {
        validateResourceName('category', category);
        validatePath([category]);
        const response = await axios.get(`${BASE_URL}/${category}`);
        return response.data;
    } catch (error) {
        throw handleError(error, `fetch ${category} items`);
    }
};

// Get single item
export const getItem = async (category, name) => {
    try {
        validateResourceName('category', category);
        validateResourceName(category, name);
        validatePath([category, name]);
        const response = await axios.get(`${BASE_URL}/${category}/${name}`);
        return response.data;
    } catch (error) {
        throw handleError(error, `fetch ${category} item ${name}`);
    }
};

// Create new item
export const createItem = async (category, data) => {
    try {
        validateResourceName('category', category);
        validateResourceName(category, data.name);
        validatePath([category, data.name]);
        const response = await axios.post(
            `${BASE_URL}/${category}/${data.name}`,
            data
        );
        return response.data;
    } catch (error) {
        throw handleError(error, `create ${category} item`);
    }
};

// Update existing item
export const updateItem = async (category, name, data, newName) => {
    try {
        validateResourceName('category', category);
        validateResourceName(category, name);
        if (newName) {
            validateResourceName(category, newName);
            validatePath([category, newName]);
        }
        validatePath([category, name]);
        const response = await axios.put(`${BASE_URL}/${category}/${name}`, {
            ...data,
            ...(newName && {rename: newName})
        });
        return response.data;
    } catch (error) {
        throw handleError(error, `update ${category} item ${name}`);
    }
};

// Delete item
export const deleteItem = async (category, name) => {
    try {
        validateResourceName('category', category);
        validateResourceName(category, name);
        validatePath([category, name]);
        const response = await axios.delete(`${BASE_URL}/${category}/${name}`);
        return response.data;
    } catch (error) {
        throw handleError(error, `delete ${category} item ${name}`);
    }
};

// Special endpoint wrapper
const createSpecialEndpoint = (category, endpoint) => async data => {
    try {
        validateResourceName('category', category);
        validatePath([category, endpoint]);
        const response = await axios.post(
            `${BASE_URL}/${category}/${endpoint}`,
            data
        );
        return response.data;
    } catch (error) {
        throw handleError(error, `execute ${category} ${endpoint}`);
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
    update: (name, data, newName) =>
        updateItem('custom_format', name, data, newName),
    delete: name => deleteItem('custom_format', name),
    runTests: createSpecialEndpoint('custom_format', 'test')
};

export const RegexPatterns = {
    getAll: () => getAllItems('regex_pattern'),
    get: name => getItem('regex_pattern', name),
    create: data => createItem('regex_pattern', data),
    update: (name, data, newName) =>
        updateItem('regex_pattern', name, data, newName),
    delete: name => deleteItem('regex_pattern', name),
    runTests: createSpecialEndpoint('regex_pattern', 'test')
};
