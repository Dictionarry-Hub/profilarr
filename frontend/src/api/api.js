import axios from 'axios';

export const getRegexes = async () => {
    try {
        const response = await axios.get(`/api/regex`);
        return response.data;
    } catch (error) {
        console.error('Error fetching regexes:', error);
        throw error;
    }
};

export const saveRegex = async regex => {
    try {
        const response = await axios.post(`/api/regex`, regex);
        return response.data;
    } catch (error) {
        console.error('Error saving regex:', error);
        throw error;
    }
};

export const updateRegex = async (id, regex) => {
    try {
        const response = await axios.put(`/api/regex/${id}`, regex);
        return response.data;
    } catch (error) {
        console.error('Error updating regex:', error);
        throw error;
    }
};

export const deleteRegex = async (id, force = false) => {
    try {
        const response = await axios.delete(
            `/api/regex/${id}${force ? '?force=true' : ''}`,
            {
                validateStatus: status => {
                    return (
                        (status >= 200 && status < 300) ||
                        status === 400 ||
                        status === 409
                    );
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error deleting regex:', error);
        throw error;
    }
};

export const getFormats = async () => {
    try {
        const response = await axios.get(`/api/format`);
        return response.data;
    } catch (error) {
        console.error('Error fetching formats:', error);
        throw error;
    }
};

export const saveFormat = async format => {
    try {
        const response = await axios.post(`/api/format`, format);
        return response.data;
    } catch (error) {
        console.error('Error saving format:', error);
        throw error;
    }
};

export const updateFormat = async (id, format) => {
    try {
        const response = await axios.put(`/api/format/${id}`, format);
        return response.data;
    } catch (error) {
        console.error('Error updating format:', error);
        throw error;
    }
};

export const deleteFormat = async (id, force = false) => {
    try {
        const response = await axios.delete(
            `/api/format/${id}${force ? '?force=true' : ''}`,
            {
                validateStatus: status => {
                    return (
                        (status >= 200 && status < 300) ||
                        status === 400 ||
                        status === 409
                    );
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error deleting format:', error);
        throw error;
    }
};

export const createRegex101Link = async regexData => {
    try {
        const response = await axios.post(`/api/regex/regex101`, regexData);
        return response.data;
    } catch (error) {
        console.error('Error creating regex101 link:', error);
        throw error;
    }
};

export const getSettings = async () => {
    try {
        const response = await axios.get(`/api/settings`);
        return response.data;
    } catch (error) {
        console.error('Error fetching settings:', error);
        throw error;
    }
};

export const getGitStatus = async () => {
    try {
        const response = await axios.get(`/api/git/status`);
        // Ensure has_unpushed_commits is included in the response
        return {
            ...response.data,
            data: {
                ...response.data.data,
                has_unpushed_commits:
                    response.data.data.has_unpushed_commits || false
            }
        };
    } catch (error) {
        console.error('Error fetching Git status:', error);
        throw error;
    }
};

export const getBranches = async () => {
    try {
        const response = await axios.get(`/api/git/branches`);
        return response.data;
    } catch (error) {
        console.error('Error fetching branches:', error);
        throw error;
    }
};

export const checkoutBranch = async branchName => {
    try {
        const response = await axios.post(
            `/api/git/checkout`,
            {
                branch: branchName
            },
            {
                validateStatus: status => {
                    return (
                        (status >= 200 && status < 300) ||
                        status === 400 ||
                        status === 409
                    );
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error checking out branch:', error);
        throw error;
    }
};

export const createBranch = async (branchName, baseBranch) => {
    try {
        const response = await axios.post(
            `/api/git/branch`,
            {
                name: branchName,
                base: baseBranch
            },
            {
                validateStatus: status => {
                    return (
                        (status >= 200 && status < 300) ||
                        status === 400 ||
                        status === 409
                    );
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error creating branch:', error);
        throw error;
    }
};

export const deleteBranch = async branchName => {
    try {
        const response = await axios.delete(`/api/git/branch/${branchName}`, {
            validateStatus: status => {
                return (
                    (status >= 200 && status < 300) ||
                    status === 400 ||
                    status === 409
                );
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error deleting branch:', error);
        throw error;
    }
};

export const pushBranchToRemote = async branchName => {
    try {
        const response = await axios.post(
            `/api/git/branch/push`,
            {
                branch: branchName
            },
            {
                validateStatus: status => {
                    return (
                        (status >= 200 && status < 300) ||
                        status === 400 ||
                        status === 409
                    );
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error pushing branch to remote:', error);
        throw error;
    }
};

export const addFiles = async files => {
    try {
        const response = await axios.post(`/api/git/stage`, {files});
        return response.data;
    } catch (error) {
        console.error('Error staging files:', error);
        throw error;
    }
};

export const unstageFiles = async files => {
    try {
        const response = await axios.post(`/api/git/unstage`, {
            files
        });
        return response.data;
    } catch (error) {
        console.error('Error unstaging files:', error);
        throw error;
    }
};

export const commitFiles = async (files, commitMessage) => {
    try {
        const response = await axios.post(`/api/git/commit`, {
            files,
            commit_message: commitMessage
        });
        return response.data;
    } catch (error) {
        console.error('Error committing files:', error);
        throw error;
    }
};

export const pushFiles = async () => {
    try {
        const response = await axios.post(`/api/git/push`);
        return response.data;
    } catch (error) {
        // Pass through the structured error from the backend
        if (error.response?.data) {
            return {
                success: false,
                error: error.response.data.error
            };
        }
        return {
            success: false,
            error: 'Failed to push changes'
        };
    }
};
export const revertFile = async filePath => {
    try {
        const response = await axios.post(`/api/git/revert`, {
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
        const response = await axios.post(`/api/git/revert-all`);
        return response.data;
    } catch (error) {
        console.error('Error reverting all changes:', error);
        throw error;
    }
};

export const deleteFile = async filePath => {
    try {
        const response = await axios.delete(`/api/git/file`, {
            data: {file_path: filePath}
        });
        return response.data;
    } catch (error) {
        console.error('Error deleting file:', error);
        return {success: false, error: 'Error deleting file'};
    }
};

export const pullBranch = async branchName => {
    try {
        const response = await axios.post(`/api/git/pull`, {
            branch: branchName
        });
        return response.data;
    } catch (error) {
        if (error.response?.data) {
            return {
                success: false,
                state: error.response.data.state || 'error',
                message: error.response.data.message,
                details: error.response.data.details
            };
        }
        return {
            success: false,
            state: 'error',
            message: 'Failed to pull changes'
        };
    }
};

export const cloneRepo = async gitRepo => {
    try {
        const response = await axios.post(`/api/git/clone`, {
            gitRepo
        });
        return response.data;
    } catch (error) {
        console.error('Error cloning repository:', error);
        throw error;
    }
};

export const getProfiles = async () => {
    try {
        const response = await axios.get(`/api/profile`);
        return response.data;
    } catch (error) {
        console.error('Error fetching profiles:', error);
        throw error;
    }
};

export const saveProfile = async profile => {
    try {
        const response = await axios.post(`/api/profile`, profile);
        return response.data;
    } catch (error) {
        console.error('Error saving profile:', error);
        throw error;
    }
};

export const updateProfile = async (id, profile) => {
    try {
        const response = await axios.put(`/api/profile/${id}`, profile);
        return response.data;
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
};

export const deleteProfile = async id => {
    try {
        const response = await axios.delete(`/api/profile/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting profile:', error);
        throw error;
    }
};

export const unlinkRepo = async (removeFiles = false) => {
    try {
        const response = await axios.post(`/api/git/unlink`, {
            removeFiles
        });
        return response.data;
    } catch (error) {
        console.error('Error unlinking repository:', error);
        throw error;
    }
};

export const checkDevMode = async () => {
    try {
        const response = await axios.get(`/api/git/dev`);
        return response.data;
    } catch (error) {
        console.error('Error checking dev mode:', error);
        throw error;
    }
};

export const resolveConflict = async resolutions => {
    try {
        const response = await axios.post(`/api/git/resolve`, {
            resolutions
        });
        return response.data;
    } catch (error) {
        console.error('Error resolving conflicts:', error);
        throw error;
    }
};

export const finalizeMerge = async () => {
    try {
        const response = await axios.post(`/api/git/merge/finalize`);
        return response.data;
    } catch (error) {
        console.error('Error finalizing merge:', error);
        if (error.response?.data) {
            return {
                success: false,
                error: error.response.data.error
            };
        }
        return {
            success: false,
            error: 'Failed to finalize merge'
        };
    }
};

export const abortMerge = async () => {
    try {
        const response = await axios.post(`/api/git/merge/abort`);
        return response.data;
    } catch (error) {
        console.error('Error aborting merge:', error);
        throw error;
    }
};

export const getCommitHistory = async () => {
    try {
        const response = await axios.get('/api/git/commits', {
            validateStatus: status => {
                return (status >= 200 && status < 300) || status === 400;
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching commit history:', error);
        if (error.response?.data) {
            return {
                success: false,
                error: error.response.data.error
            };
        }
        return {
            success: false,
            error: 'Failed to fetch commit history'
        };
    }
};
