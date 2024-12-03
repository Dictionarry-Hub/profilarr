import React from 'react';
import PropTypes from 'prop-types';
import {CONDITION_TYPES, createCondition} from './conditionTypes';
import BrowserSelect from '@ui/BrowserSelect';

const ConditionCard = ({condition, onChange, onDelete, patterns}) => {
    const conditionType = CONDITION_TYPES[condition.type?.toUpperCase()];
    const Component = conditionType?.component;

    // Convert condition types to options format
    const typeOptions = Object.values(CONDITION_TYPES).map(type => ({
        value: type.id,
        label: type.name
    }));

    // When type changes, create a fresh condition of the new type
    const handleTypeChange = e => {
        const newType = e.target.value;
        const newCondition = createCondition(newType);
        // Preserve the name if it exists
        if (condition.name) {
            newCondition.name = condition.name;
        }
        onChange(newCondition);
    };

    return (
        <div className='bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4'>
            {/* Custom Name Input */}
            <div className='mb-4'>
                <input
                    id='custom-name'
                    type='text'
                    value={condition.name || ''}
                    onChange={e =>
                        onChange({...condition, name: e.target.value})
                    }
                    placeholder='Enter a condition name...'
                    className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 
                 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 
                 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'
                />
            </div>

            <div className='flex items-center gap-4'>
                {/* Type Selection */}
                <BrowserSelect
                    value={condition.type || ''}
                    onChange={handleTypeChange}
                    options={typeOptions}
                    placeholder='Select type...'
                    className='min-w-[140px] px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                             rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                />

                {/* Render the specific condition component */}
                {Component && (
                    <Component
                        condition={condition}
                        onChange={onChange}
                        patterns={patterns}
                    />
                )}

                {/* Universal Controls */}
                <div className='flex items-center gap-3'>
                    {/* Required Checkbox */}
                    <label className='flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300'>
                        <input
                            type='checkbox'
                            checked={condition.required}
                            onChange={e =>
                                onChange({
                                    ...condition,
                                    required: e.target.checked
                                })
                            }
                            className='rounded border-gray-300 dark:border-gray-600'
                        />
                        Required
                    </label>

                    {/* Negate Checkbox */}
                    <label className='flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300'>
                        <input
                            type='checkbox'
                            checked={condition.negate}
                            onChange={e =>
                                onChange({
                                    ...condition,
                                    negate: e.target.checked
                                })
                            }
                            className='rounded border-gray-300 dark:border-gray-600'
                        />
                        Negate
                    </label>

                    {/* Delete Button */}
                    <button
                        onClick={onDelete}
                        className='text-gray-400 hover:text-red-500 transition-colors'>
                        <svg
                            className='w-4 h-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'>
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='2'
                                d='M6 18L18 6M6 6l12 12'
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

ConditionCard.propTypes = {
    condition: PropTypes.shape({
        name: PropTypes.string,
        type: PropTypes.string,
        required: PropTypes.bool,
        negate: PropTypes.bool
    }).isRequired,
    onChange: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    patterns: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            description: PropTypes.string
        })
    ).isRequired
};

export default ConditionCard;
