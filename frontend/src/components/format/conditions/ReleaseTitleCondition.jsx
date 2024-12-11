import React from 'react';
import PropTypes from 'prop-types';

const ReleaseTitleCondition = ({condition, onChange, patterns}) => {
    const sortedPatterns = [...patterns].sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    return (
        <select
            className='flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700'
            value={condition.pattern || ''}
            onChange={e => onChange({...condition, pattern: e.target.value})}>
            <option value=''>Select release title pattern...</option>
            {sortedPatterns.map(pattern => (
                <option key={pattern.name} value={pattern.name}>
                    {pattern.name}
                </option>
            ))}
        </select>
    );
};

ReleaseTitleCondition.propTypes = {
    condition: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    patterns: PropTypes.array.isRequired
};

export default ReleaseTitleCondition;
