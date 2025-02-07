import React from 'react';
import PropTypes from 'prop-types';
import {CONDITION_TYPES, createCondition} from './conditionTypes';
import {ArrowUp, ArrowDown, X, ChevronsUp, ChevronsDown} from 'lucide-react';
import BrowserSelect from '@ui/BrowserSelect';

const ConditionCard = ({
    condition,
    onChange,
    onDelete,
    patterns,
    onMoveUp,
    onMoveDown,
    onMoveToTop,
    onMoveToBottom,
    isFirst,
    isLast
}) => {
    const conditionType = CONDITION_TYPES[condition.type?.toUpperCase()];
    const Component = conditionType?.component;

    const typeOptions = Object.values(CONDITION_TYPES).map(type => ({
        value: type.id,
        label: type.name
    }));

    const handleTypeChange = e => {
        const newType = e.target.value;
        const newCondition = createCondition(newType);
        if (condition.name) {
            newCondition.name = condition.name;
        }
        onChange(newCondition);
    };

    return (
        <div className='relative bg-gradient-to-br from-gray-800/95 to-gray-900 rounded-lg border border-gray-700 shadow-lg hover:shadow-xl transition-shadow'>
            {/* Main content */}
            <div className='p-4 pr-14 space-y-4'>
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
                        className='w-full px-3 py-2 text-sm rounded-md
                            bg-gray-700 border border-gray-700
                            text-gray-200 placeholder:text-gray-400
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                            transition-colors'
                    />
                </div>

                <div className='flex items-center gap-4'>
                    {/* Type Selection */}
                    <BrowserSelect
                        value={condition.type || ''}
                        onChange={handleTypeChange}
                        options={typeOptions}
                        placeholder='Select type...'
                        className='min-w-[140px] px-3 py-2 text-sm rounded-md
                            bg-gray-700 border border-gray-700
                            text-gray-200'
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
                    <div className='flex items-center gap-3 ml-auto'>
                        {/* Required Checkbox */}
                        <label className='flex items-center gap-2 cursor-pointer'>
                            <input
                                type='checkbox'
                                checked={condition.required}
                                onChange={e =>
                                    onChange({
                                        ...condition,
                                        required: e.target.checked
                                    })
                                }
                                className='rounded border-gray-700 bg-gray-800/50
                                    text-blue-500 focus:ring-blue-500
                                    transition-colors'
                            />
                            <span className='text-sm font-medium text-gray-300'>
                                Required
                            </span>
                        </label>

                        {/* Negate Checkbox */}
                        <label className='flex items-center gap-2 cursor-pointer'>
                            <input
                                type='checkbox'
                                checked={condition.negate}
                                onChange={e =>
                                    onChange({
                                        ...condition,
                                        negate: e.target.checked
                                    })
                                }
                                className='rounded border-gray-700 bg-gray-800/50
                                    text-blue-500 focus:ring-blue-500
                                    transition-colors'
                            />
                            <span className='text-sm font-medium text-gray-300'>
                                Negate
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Control Buttons */}
            <div
                className='absolute right-0 top-0 bottom-0 flex flex-col 
                divide-y divide-gray-700/50 border-l border-gray-700/50 bg-gray-800/30'>
                <button
                    onClick={onMoveToTop}
                    disabled={isFirst}
                    className='flex items-center justify-center w-10 flex-1
                        text-gray-400 hover:text-gray-200 hover:bg-gray-700/50
                        disabled:opacity-50 disabled:pointer-events-none
                        transition-colors'>
                    <ChevronsUp className='w-4 h-4' />
                </button>
                <button
                    onClick={onMoveUp}
                    disabled={isFirst}
                    className='flex items-center justify-center w-10 flex-1
                        text-gray-400 hover:text-gray-200 hover:bg-gray-700/50
                        disabled:opacity-50 disabled:pointer-events-none
                        transition-colors'>
                    <ArrowUp className='w-4 h-4' />
                </button>
                <button
                    onClick={onMoveDown}
                    disabled={isLast}
                    className='flex items-center justify-center w-10 flex-1
                        text-gray-400 hover:text-gray-200 hover:bg-gray-700/50
                        disabled:opacity-50 disabled:pointer-events-none
                        transition-colors'>
                    <ArrowDown className='w-4 h-4' />
                </button>
                <button
                    onClick={onMoveToBottom}
                    disabled={isLast}
                    className='flex items-center justify-center w-10 flex-1
                        text-gray-400 hover:text-gray-200 hover:bg-gray-700/50
                        disabled:opacity-50 disabled:pointer-events-none
                        transition-colors'>
                    <ChevronsDown className='w-4 h-4' />
                </button>
                <button
                    onClick={onDelete}
                    className='flex items-center justify-center w-10 flex-1
                        text-gray-400 hover:text-red-400 hover:bg-red-400/10
                        transition-colors'>
                    <X className='w-4 h-4' />
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
    onMoveToTop: PropTypes.func.isRequired,
    onMoveToBottom: PropTypes.func.isRequired,
    isFirst: PropTypes.bool.isRequired,
    isLast: PropTypes.bool.isRequired
};

export default ConditionCard;
