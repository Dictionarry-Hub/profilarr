import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronRight } from 'lucide-react';

const QualityGroup = ({ title, children, isExpanded = false, onToggle, unitLabel }) => {
    return (
        <div className="border border-gray-700 dark:border-gray-700 rounded-lg overflow-hidden mb-4">
            {/* Header Section */}
            <button
                onClick={onToggle}
                className={`w-full bg-gray-800/30 px-4 py-2.5 hover:bg-gray-700/30 flex items-center justify-between transition-[background-color] ${
                    isExpanded ? 'border-b-2 border-gray-700/50' : ''
                }`}
            >
                <h3 className="text-sm font-medium text-gray-200">
                    {title}
                </h3>
                {isExpanded ?
                    <ChevronDown size={14} className="text-gray-400" /> :
                    <ChevronRight size={14} className="text-gray-400" />
                }
            </button>

            {/* Body Section */}
            {isExpanded && (
                <div className="overflow-hidden">
                    <table className="w-full">
                        <thead className="hidden sm:table-header-group">
                            <tr>
                                <th className="text-left pl-6 px-4 pt-4 pb-2 text-xs font-medium text-gray-300 w-40">Quality</th>
                                <th className="text-left px-2 pt-4 pb-2 text-xs font-medium text-gray-300">Range <span className="text-gray-400 font-normal">({unitLabel})</span></th>
                                <th className="text-center px-1 pt-4 pb-2 text-xs font-medium text-gray-300 w-16">Min</th>
                                <th className="text-center px-1 pt-4 pb-2 text-xs font-medium text-gray-300 w-20">Preferred</th>
                                <th className="text-center px-1 pt-4 pb-2 text-xs font-medium text-gray-300 w-16">Max</th>
                            </tr>
                        </thead>
                        <tbody>
                            {children}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

QualityGroup.propTypes = {
    title: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    isExpanded: PropTypes.bool,
    onToggle: PropTypes.func.isRequired,
    unitLabel: PropTypes.string.isRequired
};

export default QualityGroup;