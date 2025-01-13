import React from 'react';

const UNITS = [{value: 'GB', label: 'GB'}];

const SizeCondition = ({condition, onChange}) => {
    const handleSizeChange = (key, value) => {
        onChange({...condition, [key]: value});
    };

    const renderSizeField = (placeholder, key, value, unitKey, unitValue) => (
        <div className='flex items-center gap-2'>
            <input
                type='number'
                min='0'
                value={value || ''}
                onChange={e => handleSizeChange(key, e.target.value)}
                placeholder={placeholder}
                className='w-40 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
                 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'
            />
            <select
                value={unitValue || 'MB'}
                onChange={e => handleSizeChange(unitKey, e.target.value)}
                className='px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'>
                {UNITS.map(unit => (
                    <option key={unit.value} value={unit.value}>
                        {unit.label}
                    </option>
                ))}
            </select>
        </div>
    );

    return (
        <div className='flex items-center gap-6'>
            {renderSizeField(
                'Enter min size',
                'minSize',
                condition.minSize,
                'minSizeUnit',
                condition.minSizeUnit
            )}
            {renderSizeField(
                'Enter max size',
                'maxSize',
                condition.maxSize,
                'maxSizeUnit',
                condition.maxSizeUnit
            )}
        </div>
    );
};

export default SizeCondition;
