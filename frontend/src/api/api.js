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

export const deleteRegex = async (id, force = false) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/regex/${id}${force ? '?force=true' : ''}`, {
            validateStatus: (status) => {
                return status >= 200 && status < 300 || status === 400 || status === 409;
            }
        });
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

export const deleteFormat = async (id, force = false) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/format/${id}${force ? '?force=true' : ''}`, {
            validateStatus: (status) => {
                return status >= 200 && status < 300 || status === 400 || status === 409;
            }
        });
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

export const getSettings = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/settings`);
        return response.data;
    } catch (error) {
        console.error('Error fetching settings:', error);
        throw error;
    }
};

export const getGitStatus = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/git/status`);
        return response.data;
    } catch (error) {
        console.error('Error fetching Git status:', error);
        throw error;
    }
};

export const getBranches = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/git/branches`);
        return response.data;
    } catch (error) {
        console.error('Error fetching branches:', error);
        throw error;
    }
};

export const checkoutBranch = async (branchName) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/git/checkout`, { branch: branchName });
        return response.data;
    } catch (error) {
        console.error('Error checking out branch:', error);
        throw error;
    }
};

export const createBranch = async (branchName, baseBranch) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/git/branch`, { name: branchName, base: baseBranch });
        return response.data;
    } catch (error) {
        console.error('Error creating branch:', error);
        throw error;
    }
};

export const deleteBranch = async (branchName) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/git/branch/${branchName}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting branch:', error);
        throw error;
    }
};

export const addFiles = async (files) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/git/stage`, { files });
        return response.data;
    } catch (error) {
        console.error('Error staging files:', error);
        throw error;
    }
};

export const pushFiles = async (files, commitMessage) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/git/push`, {
            files,
            commit_message: commitMessage
        });
        return response.data;
    } catch (error) {
        console.error('Error pushing files:', error);
        throw error;
    }
};

export const revertFile = async (filePath) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/git/revert`, {
            file_path: filePath
        });
        return response.data;
    } catch (error) {
        console.error('Error reverting file:', error);
        throw error;
    }
};

export const revertAll = async () => {
    try {
        const response = await axios.post(`${API_BASE_URL}/git/revert-all`);
        return response.data;
    } catch (error) {
        console.error('Error reverting all changes:', error);
        throw error;
    }
};

export const deleteFile = async (filePath) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/git/file`, {
            data: { file_path: filePath },
        });
        return response.data;
    } catch (error) {
        console.error('Error deleting file:', error);
        return { success: false, error: 'Error deleting file' };
    }
};

export const pullBranch = async (branchName) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/git/pull`, { branch: branchName });
        return response.data;
    } catch (error) {
        console.error('Error pulling branch:', error);
        throw error;
    }
};

export const getDiff = async (filePath) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/git/diff`, { file_path: filePath });
        return response.data;
    } catch (error) {
        console.error('Error fetching diff:', error);
        throw error;
    }
};

export const cloneRepo = async (gitRepo, gitToken) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/git/clone`, { gitRepo, gitToken });
        return response.data;
    } catch (error) {
        console.error('Error cloning repository:', error);
        throw error;
    }
};

export const getProfiles = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/profile`);
        return response.data;
    } catch (error) {
        console.error('Error fetching profiles:', error);
        throw error;
    }
};

export const saveProfile = async (profile) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/profile`, profile);
        return response.data;
    } catch (error) {
        console.error('Error saving profile:', error);
        throw error;
    }
};

export const updateProfile = async (id, profile) => {
    try {
        const response = await axios.put(`${API_BASE_URL}/profile/${id}`, profile);
        return response.data;
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
};

export const deleteProfile = async (id) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/profile/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting profile:', error);
        throw error;
    }
};

export const unlinkRepo = async (removeFiles = false) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/git/unlink`, { removeFiles });
        return response.data;
    } catch (error) {
        console.error('Error unlinking repository:', error);
        throw error;
    }
};

