import React from 'react';
import PropTypes from 'prop-types';
import SearchDropdown from '@ui/SearchDropdown';

const ReleaseTitleCondition = ({condition, onChange, patterns}) => {
    // Format patterns for the dropdown with enhanced descriptions
    const patternOptions = patterns.map(pattern => ({
        value: pattern.name,
        label: pattern.name,
        description: pattern.description || 'No description available',
        priority: pattern.priority
    }));

    const handlePatternChange = e => {
        onChange({...condition, pattern: e.target.value});
    };

    return (
        <div className="flex-1">
            <SearchDropdown
                value={condition.pattern || ''}
                onChange={handlePatternChange}
                options={patternOptions}
                placeholder='Select release title pattern...'
                searchableFields={['label', 'description']}
                className='min-w-[200px]'
                width='w-auto'
                dropdownWidth='100%'
            />
        </div>
    );
};

ReleaseTitleCondition.propTypes = {
    condition: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    patterns: PropTypes.array.isRequired
};

export default ReleaseTitleCondition;
