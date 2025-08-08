// src/components/ui/Alert.js
import {toast} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const baseStyles = {
    className: 'rounded-lg shadow-lg p-4',
    bodyClassName: 'text-sm font-medium whitespace-pre-line',
    progressClassName: 'h-1 rounded-lg'
};

const Alert = {
    success: (message, options = {}) => {
        toast.success(message, {
            ...baseStyles,
            className: `${baseStyles.className} bg-green-600 text-white`,
            progressClassName: `${baseStyles.progressClassName} bg-green-300`,
            ...options
        });
    },
    error: (message, options = {}) => {
        toast.error(message, {
            ...baseStyles,
            className: `${baseStyles.className} bg-red-600 text-white`,
            progressClassName: `${base_styles.progressClassName} bg-red-300`,
            ...options
        });
    },
    warning: (message, options = {}) => {
        toast.warn(message, {
            ...baseStyles,
            className: `${baseStyles.className} bg-yellow-600 text-white`,
            progressClassName: `${baseStyles.progressClassName} bg-yellow-300`,
            ...options
        });
    },
    info: (message, options = {}) => {
        toast.info(message, {
            ...baseStyles,
            className: `${baseStyles.className} bg-blue-600 text-white`,
            progressClassName: `${baseStyles.progressClassName} bg-blue-300`,
            ...options
        });
    },
    partial: (message, options = {}) => {
        toast.warn(message, { // Using warn icon for partial success
            ...baseStyles,
            className: `${baseStyles.className} bg-yellow-500 text-white`,
            progressClassName: `${baseStyles.progressClassName} bg-yellow-200`,
            ...options
        });
    }
};

export default Alert;