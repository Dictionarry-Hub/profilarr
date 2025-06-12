import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import CategoryActions from './CategoryActions';

const CategoryContainer = ({
    title,
    children,
    onSync,
    onSave,
    isSaving = false,
    isSyncing = false,
    isExpanded = true
}) => {
    const [expanded, setExpanded] = useState(isExpanded);

    return (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg mb-6 border border-gray-700">
            {/* Header Section */}
            <button
                onClick={() => setExpanded(!expanded)}
                className={`w-full bg-gray-800/50 px-6 py-3.5 hover:bg-gray-700/50 transition-[background-color] ${
                    expanded ? 'border-b border-gray-700' : ''
                }`}
            >
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <h1 className="text-sm sm:text-base font-semibold text-gray-100">
                            {title}
                        </h1>
                        {expanded ?
                            <ChevronDown size={16} className="text-gray-400" /> :
                            <ChevronRight size={16} className="text-gray-400" />
                        }
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                        <CategoryActions
                            onSync={onSync}
                            onSave={onSave}
                            isSaving={isSaving}
                            isSyncing={isSyncing}
                        />
                    </div>
                </div>
            </button>

            {/* Body Section */}
            {expanded && (
                <div className="p-6">
                    {children}
                </div>
            )}
        </div>
    );
};

CategoryContainer.propTypes = {
    title: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    onSync: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    isSaving: PropTypes.bool,
    isSyncing: PropTypes.bool,
    isExpanded: PropTypes.bool
};

export default CategoryContainer;