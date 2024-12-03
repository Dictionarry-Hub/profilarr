import React from 'react';
import PropTypes from 'prop-types';
import BrowserSelect from '@ui/BrowserSelect';

const EditionCondition = ({condition, onChange, patterns}) => {
    // Convert patterns to options format
    const patternOptions = patterns.map(pattern => ({
        value: pattern.name,
        label: pattern.name
    }));

    return (
        <div className='flex-1'>
            <BrowserSelect
                value={condition.pattern || ''}
                onChange={e =>
                    onChange({...condition, pattern: e.target.value})
                }
                options={patternOptions}
                placeholder='Select edition pattern...'
                className='w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                          rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />
        </div>
    );
};

EditionCondition.propTypes = {
    condition: PropTypes.shape({
        pattern: PropTypes.string
    }).isRequired,
    onChange: PropTypes.func.isRequired,
    patterns: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            description: PropTypes.string
        })
    ).isRequired
};

export default EditionCondition;
