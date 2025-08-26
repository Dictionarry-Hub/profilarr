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

// Define characters and patterns that could cause routing issues with descriptive messages
const UNSAFE_PATTERNS = [
    {pattern: /[\/\\]/, message: 'Cannot contain forward or backward slashes'},
    {
        pattern: /[<>:"|?*]/,
        message: 'Cannot contain special characters (<, >, :, ", |, ?, *)'
    },
    {
        pattern: /^\.+/,
        message: 'Cannot start with dots (prevents relative paths)'
    },
    {pattern: /\.+$/, message: 'Cannot end with dots'},
    {pattern: /^-/, message: 'Cannot start with a dash'},
    {pattern: /-$/, message: 'Cannot end with a dash'},
    {
        pattern: /--|__|\.\./,
        message: 'Cannot contain consecutive dashes, underscores, or dots'
    }
];

// Comprehensive name validation with specific error messages
const validateResourceName = (category, name) => {
    // Basic type check
    if (!name) {
        throw new Error(`${category} name cannot be empty`);
    }

    if (typeof name !== 'string') {
        throw new Error(
            `${category} name must be a string, received ${typeof name}`
        );
    }

    // Length check
    if (name.length < 1) {
        throw new Error(`${category} name must be at least 1 character long`);
    }

    if (name.length > 64) {
        throw new Error(
            `${category} name cannot exceed 64 characters (current length: ${name.length})`
        );
    }

    // Check for special endpoints
    if (SPECIAL_ENDPOINTS.includes(name.toLowerCase())) {
        throw new Error(
            `'${name}' is a reserved word and cannot be used as a ${category} name. Reserved words: ${SPECIAL_ENDPOINTS.join(
                ', '
            )}`
        );
    }

    // Check for unsafe patterns with specific messages
    for (const {pattern, message} of UNSAFE_PATTERNS) {
        if (pattern.test(name)) {
            throw new Error(`Invalid ${category} name '${name}': ${message}`);
        }
    }

    return true;
};

// Validate entire path with specific error messages
const validatePath = parts => {
    if (!Array.isArray(parts)) {
        throw new Error(
            `Path must be an array of segments, received ${typeof parts}`
        );
    }

    if (parts.length === 0) {
        throw new Error('Path cannot be empty');
    }

    const joinedPath = parts.join('/');

    // Check for path traversal attempts
    if (joinedPath.includes('..')) {
        throw new Error(
            'Invalid path: Contains parent directory reference (..)'
        );
    }

    if (joinedPath.includes('./')) {
        throw new Error(
            'Invalid path: Contains current directory reference (./)'
        );
    }

    if (joinedPath.includes('/.')) {
        throw new Error(
            'Invalid path: Contains hidden directory reference (/.)'
        );
    }

    // Check for invalid start/end
    if (joinedPath.startsWith('/')) {
        throw new Error('Invalid path: Cannot start with a separator (/)');
    }

    if (joinedPath.endsWith('/')) {
        throw new Error('Invalid path: Cannot end with a separator (/)');
    }

    // Validate each path segment
    parts.forEach((segment, index) => {
        if (typeof segment !== 'string') {
            throw new Error(
                `Path segment at position ${index} must be a string, received ${typeof segment}`
            );
        }

        if (segment.length === 0) {
            throw new Error(
                `Path segment at position ${index} cannot be empty`
            );
        }
    });

    return true;
};

// Enhanced error handler with more specific messages
const handleError = (error, operation) => {
    console.error(`Error during ${operation}:`, error);

    if (error instanceof Error) {
        throw error;
    }

    if (error.response?.data) {
        const errorData = error.response.data;
        const message =
            errorData.error ||
            errorData.message ||
            errorData.detail ||
            (typeof errorData === 'string' ? errorData : null);

        if (message) {
            throw new Error(`${operation} failed: ${message}`);
        }
    }

    // Include HTTP status in generic error if available
    if (error.response?.status) {
        throw new Error(
            `Failed to ${operation} (HTTP ${error.response.status})`
        );
    }

    throw new Error(`Failed to ${operation}: Unknown error occurred`);
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
        console.log(`Sending data to ${endpoint}:`, data);
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
    runTests: createSpecialEndpoint('regex_pattern', 'test'),
    verify: async pattern => {
        try {
            const response = await axios.post(`${BASE_URL}/regex/verify`, {
                pattern
            });
            return response.data;
        } catch (error) {
            throw handleError(error, 'verify regex pattern');
        }
    }
};
