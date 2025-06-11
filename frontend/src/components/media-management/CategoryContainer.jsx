import React from 'react';
import PropTypes from 'prop-types';
import CategoryActions from './CategoryActions';

const CategoryContainer = ({
    title,
    children,
    onSync,
    onSave,
    isSaving = false,
    isSyncing = false
}) => {
    return (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden mb-6 border border-gray-700">
            {/* Header Section */}
            <div className="bg-gray-800/50 px-4 py-2.5 border-b border-gray-700">
                <div className="flex justify-between items-center">
                    <h1 className="text-base font-semibold text-gray-100">
                        {title}
                    </h1>
                    <CategoryActions
                        onSync={onSync}
                        onSave={onSave}
                        isSaving={isSaving}
                        isSyncing={isSyncing}
                    />
                </div>
            </div>

            {/* Body Section */}
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};

CategoryContainer.propTypes = {
    title: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    onSync: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    isSaving: PropTypes.bool,
    isSyncing: PropTypes.bool
};

export default CategoryContainer;