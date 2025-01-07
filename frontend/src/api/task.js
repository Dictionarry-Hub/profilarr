import axios from 'axios';

export const getAllTasks = async () => {
    try {
        const response = await axios.get('/api/tasks');
        return response.data;
    } catch (error) {
        console.error('Error fetching tasks:', error);
        throw error;
    }
};

export const getTask = async taskId => {
    try {
        const response = await axios.get(`/api/tasks/${taskId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching task:', error);
        throw error;
    }
};

export const triggerTask = async taskId => {
    try {
        const response = await axios.post(`/api/tasks/${taskId}/run`);
        // Return a success object when the request succeeds
        return {
            success: true,
            message: response.data.message
        };
    } catch (error) {
        console.error('Error triggering task:', error);
        // Return a failure object when the request fails
        return {
            success: false,
            message: error.response?.data?.error || 'Failed to trigger task'
        };
    }
};
