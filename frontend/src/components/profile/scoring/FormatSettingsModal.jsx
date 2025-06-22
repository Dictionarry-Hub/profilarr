import React from 'react';
import PropTypes from 'prop-types';
import Modal from '@ui/Modal';
import TabViewer from '@ui/TabViewer';

const FormatSettingsModal = ({
    isOpen,
    onClose,
    activeApp,
    onAppChange,
    isAdvancedView,
    onViewChange
}) => {
    const appTabs = [
        {id: 'both', label: 'Both'},
        {id: 'radarr', label: 'Radarr'},
        {id: 'sonarr', label: 'Sonarr'}
    ];

    const viewTabs = [
        {id: 'basic', label: 'Basic'},
        {id: 'advanced', label: 'Advanced'}
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Format Settings"
            width="md"
            level={1}
        >
            <div className="space-y-6">
                <div>
                    <h3 className="text-sm font-medium text-gray-200 mb-2">Application Target</h3>
                    <p className="text-xs text-gray-400 mb-3">
                        Choose which application(s) these format scores will apply to. Setting scores in one category automatically clears them from conflicting categories.
                    </p>
                    <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        {[
                            {key: 'both', label: 'Both'},
                            {key: 'radarr', label: 'Radarr'},
                            {key: 'sonarr', label: 'Sonarr'}
                        ].map(app => (
                            <button
                                key={app.key}
                                onClick={() => onAppChange(app.key)}
                                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                    activeApp === app.key
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                {app.label}
                            </button>
                        ))}
                    </div>
                </div>

                <hr className="border-gray-700" />

                <div>
                    <h3 className="text-sm font-medium text-gray-200 mb-2">Display Mode</h3>
                    <p className="text-xs text-gray-400 mb-3">
                        Choose how format scores are displayed and edited.
                    </p>
                    <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        {[
                            {key: 'basic', label: 'Basic'},
                            {key: 'advanced', label: 'Advanced'}
                        ].map(mode => (
                            <button
                                key={mode.key}
                                onClick={() => onViewChange(mode.key === 'advanced')}
                                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                    (isAdvancedView ? 'advanced' : 'basic') === mode.key
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

FormatSettingsModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    activeApp: PropTypes.oneOf(['both', 'radarr', 'sonarr']).isRequired,
    onAppChange: PropTypes.func.isRequired,
    isAdvancedView: PropTypes.bool.isRequired,
    onViewChange: PropTypes.func.isRequired
};

export default FormatSettingsModal;