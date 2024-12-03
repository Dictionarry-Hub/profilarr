import React from 'react';
import PropTypes from 'prop-types';

const YearCondition = ({condition, onChange}) => {
    const handleYearChange = (key, value) => {
        onChange({...condition, [key]: value});
    };

    const renderYearField = (placeholder, key, value) => (
        <input
            type='number'
            min='0'
            value={value || ''}
            onChange={e => handleYearChange(key, e.target.value)}
            placeholder={placeholder}
            className='w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                     rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'
        />
    );

    return (
        <div className='flex items-center space-x-4'>
            {renderYearField('Enter min year', 'minYear', condition.minYear)}
            {renderYearField('Enter max year', 'maxYear', condition.maxYear)}
        </div>
    );
};

YearCondition.propTypes = {
    condition: PropTypes.shape({
        minYear: PropTypes.string,
        maxYear: PropTypes.string
    }).isRequired,
    onChange: PropTypes.func.isRequired
};

export default YearCondition;
