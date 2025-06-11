import React from 'react';
import PropTypes from 'prop-types';
import { Save, RefreshCw, Check } from 'lucide-react';

const CategoryActions = ({ onSync, onSave, isSaving = false, isSyncing = false }) => {
    return (
        <div className="flex gap-2">
            <button
                onClick={onSync}
                disabled={isSyncing || isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-700/50 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
                {isSyncing ? (
                    <Check className="w-4 h-4 text-green-500" />
                ) : (
                    <RefreshCw className="w-4 h-4 text-blue-500" />
                )}
                <span>Sync</span>
            </button>
            <button
                onClick={onSave}
                disabled={isSaving || isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-700/50 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
                {isSaving ? (
                    <Check className="w-4 h-4 text-green-500" />
                ) : (
                    <Save className="w-4 h-4 text-blue-500" />
                )}
                <span>Save</span>
            </button>
        </div>
    );
};

CategoryActions.propTypes = {
    onSync: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    isSaving: PropTypes.bool,
    isSyncing: PropTypes.bool
};

export default CategoryActions;