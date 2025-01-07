import React, {useState, useEffect} from 'react';
import {getAutoPullStatus, setAutoPullStatus} from '@api/api';
import Alert from '@ui/Alert';

const AutoPullToggle = () => {
    const [isEnabled, setIsEnabled] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await getAutoPullStatus();
                setIsEnabled(response.enabled);
            } catch (error) {
                console.error('Failed to fetch auto-pull status:', error);
            }
        };
        fetchStatus();
    }, []);

    const handleClick = () => {
        if (
            window.confirm(
                `Are you sure you want to ${
                    isEnabled ? 'disable' : 'enable'
                } auto sync?`
            )
        ) {
            const newState = !isEnabled;
            setAutoPullStatus(newState)
                .then(() => {
                    setIsEnabled(newState);
                    Alert.success(
                        `Auto sync ${newState ? 'enabled' : 'disabled'}`
                    );
                })
                .catch(error => {
                    console.error('Failed to update auto-pull status:', error);
                    Alert.error('Failed to update auto-pull status');
                });
        }
    };

    return (
        <div className='flex items-center gap-2 ml-auto'>
            <span className='text-sm text-gray-400'>
                {isEnabled ? 'Auto sync enabled' : 'Auto sync disabled'}
            </span>
            <button
                onClick={handleClick}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                    isEnabled ? 'bg-green-500' : 'bg-gray-600'
                }`}>
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
            </button>
        </div>
    );
};

export default AutoPullToggle;
