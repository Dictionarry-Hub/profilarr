import axios from 'axios';

export const pingService = async (url, apiKey, type) => {
    try {
        const response = await axios.post(
            `/api/arr/ping`,
            {
                url,
                apiKey,
                type
            },
            {
                validateStatus: status => {
                    return (status >= 200 && status < 300) || status === 400;
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error pinging service:', error);
        if (error.response?.data) {
            return {
                success: false,
                message: error.response.data.error
            };
        }
        return {
            success: false,
            message: 'Failed to ping service'
        };
    }
};

export const saveArrConfig = async config => {
    try {
        // Validate and auto-correct sync_interval if schedule method
        const validatedConfig = {...config};
        if (validatedConfig.sync_method === 'schedule' && validatedConfig.sync_interval) {
            if (validatedConfig.sync_interval < 60) {
                validatedConfig.sync_interval = 60;
            } else if (validatedConfig.sync_interval > 43200) {
                validatedConfig.sync_interval = 43200;
            }
        }

        const response = await axios.post(`/api/arr/config`, validatedConfig, {
            validateStatus: status => {
                return (status >= 200 && status < 300) || status === 409;
            }
        });

        if (response.status === 409) {
            return {
                success: false,
                error: 'Configuration with this name already exists'
            };
        }
        return response.data;
    } catch (error) {
        console.error('Error saving arr config:', error);
        throw error;
    }
};

export const updateArrConfig = async (id, config) => {
    try {
        // Validate and auto-correct sync_interval if schedule method
        const validatedConfig = {...config};
        if (validatedConfig.sync_method === 'schedule' && validatedConfig.sync_interval) {
            if (validatedConfig.sync_interval < 60) {
                validatedConfig.sync_interval = 60;
            } else if (validatedConfig.sync_interval > 43200) {
                validatedConfig.sync_interval = 43200;
            }
        }

        const response = await axios.put(`/api/arr/config/${id}`, validatedConfig, {
            validateStatus: status => {
                return (status >= 200 && status < 300) || status === 409;
            }
        });

        if (response.status === 409) {
            return {
                success: false,
                error: 'Configuration with this name already exists'
            };
        }
        return response.data;
    } catch (error) {
        console.error('Error updating arr config:', error);
        throw error;
    }
};

export const getArrConfigs = async () => {
    try {
        const response = await axios.get(`/api/arr/config`);
        return response.data;
    } catch (error) {
        console.error('Error fetching arr configs:', error);
        throw error;
    }
};

export const deleteArrConfig = async id => {
    try {
        const response = await axios.delete(`/api/arr/config/${id}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting arr config:', error);
        throw error;
    }
};

export const triggerSync = async configId => {
    try {
        const response = await fetch(`/api/arr/config/${configId}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return await response.json();
    } catch (error) {
        console.error('Error triggering sync:', error);
        return {success: false, error: error.message};
    }
};
