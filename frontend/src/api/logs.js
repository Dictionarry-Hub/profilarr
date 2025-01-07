// api/logs.js
import axios from 'axios';

const BASE_URL = '/api/logs';

const handleError = (error, operation) => {
    console.error(`Error ${operation}:`, error);
    const errorMessage =
        error.response?.data?.error || `Failed to ${operation}`;
    throw new Error(errorMessage);
};

export const getLogsList = async () => {
    try {
        const res = await axios.get(`${BASE_URL}/`);
        return res.data;
    } catch (err) {
        handleError(err, 'fetch log files list');
    }
};

export const getLogContent = async (filename, {lines, level, search} = {}) => {
    try {
        const params = {};
        if (lines) params.lines = lines;
        if (level) params.level = level;
        if (search) params.search = search;
        const res = await axios.get(`${BASE_URL}/${filename}`, {params});
        return res.data;
    } catch (err) {
        handleError(err, `fetch log content for ${filename}`);
    }
};

export const getLogsByLevel = async level => {
    try {
        const res = await axios.get(`${BASE_URL}/level/${level}`);
        return res.data;
    } catch (err) {
        handleError(err, `fetch logs by level: ${level}`);
    }
};

export const searchLogs = async term => {
    try {
        if (!term) throw new Error('Search term required');
        const res = await axios.get(`${BASE_URL}/search`, {params: {q: term}});
        return res.data;
    } catch (err) {
        handleError(err, `search logs for term "${term}"`);
    }
};

export const Logs = {
    getLogsList,
    getLogContent,
    getLogsByLevel,
    searchLogs
};
