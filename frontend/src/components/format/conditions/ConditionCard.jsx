import React from 'react';
import PropTypes from 'prop-types';
import {CONDITION_TYPES, createCondition} from './conditionTypes';
import {ArrowUp, ArrowDown} from 'lucide-react';
import BrowserSelect from '@ui/BrowserSelect';

const ConditionCard = ({
    condition,
    onChange,
    onDelete,
    patterns,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast
}) => {
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
        <div className='relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg'>
            {/* Main content with more right padding */}
            <div className='p-4 pr-16 space-y-4'>
                {/* Content remains the same */}
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

            {/* Move Up/Down Buttons - Now positioned further right */}
            <div className='absolute right-0 top-0 bottom-0 flex flex-col divide-y divide-gray-200 dark:divide-gray-700 border-l border-gray-200 dark:border-gray-700'>
                <button
                    onClick={onMoveUp}
                    disabled={isFirst}
                    className='flex items-center justify-center w-8 h-1/2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors'>
                    <ArrowUp className='w-4 h-4' />
                </button>
                <button
                    onClick={onMoveDown}
                    disabled={isLast}
                    className='flex items-center justify-center w-8 h-1/2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors'>
                    <ArrowDown className='w-4 h-4' />
                </button>
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
    ).isRequired,
    onMoveUp: PropTypes.func.isRequired,
    onMoveDown: PropTypes.func.isRequired,
    isFirst: PropTypes.bool.isRequired,
    isLast: PropTypes.bool.isRequired
};

export default ConditionCard;
