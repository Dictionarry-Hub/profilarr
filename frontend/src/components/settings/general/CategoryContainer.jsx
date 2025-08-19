import React, {useState} from 'react';
import {ChevronDown, ChevronRight} from 'lucide-react';

const CategoryContainer = ({title, children, defaultExpanded = true}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className='bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg border border-gray-700 shadow-lg mb-6'>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full flex items-center justify-between px-6 py-3.5 bg-gray-800/50 hover:bg-gray-700/50 transition-colors ${
                    isExpanded ? 'border-b border-gray-700 rounded-t-lg' : 'rounded-lg'
                }`}>
                <h3 className='text-lg font-semibold text-gray-100'>
                    {title}
                </h3>
                {isExpanded ? (
                    <ChevronDown className='w-4 h-4 text-gray-400' />
                ) : (
                    <ChevronRight className='w-4 h-4 text-gray-400' />
                )}
            </button>
            {isExpanded && <div className='p-6'>{children}</div>}
        </div>
    );
};

export default CategoryContainer;