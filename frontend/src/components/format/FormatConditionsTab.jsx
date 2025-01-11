import React from 'react';
import PropTypes from 'prop-types';
import {Plus, InfoIcon} from 'lucide-react';
import {usePatterns} from '@hooks/usePatterns';
import {createCondition} from './conditions/conditionTypes';
import ConditionCard from './conditions/ConditionCard';

const FormatConditionsTab = ({conditions, onConditionsChange}) => {
    const {patterns, isLoading, error} = usePatterns();

    const handleAddCondition = () => {
        onConditionsChange([createCondition(), ...conditions]);
    };

    const handleConditionChange = (index, updatedCondition) => {
        const newConditions = [...conditions];
        newConditions[index] = updatedCondition;
        onConditionsChange(newConditions);
    };

    const handleConditionDelete = index => {
        onConditionsChange(conditions.filter((_, i) => i !== index));
    };

    const handleMoveUp = index => {
        if (index > 0) {
            const newConditions = [...conditions];
            [newConditions[index - 1], newConditions[index]] = [
                newConditions[index],
                newConditions[index - 1]
            ];
            onConditionsChange(newConditions);
        }
    };

    const handleMoveDown = index => {
        if (index < conditions.length - 1) {
            const newConditions = [...conditions];
            [newConditions[index], newConditions[index + 1]] = [
                newConditions[index + 1],
                newConditions[index]
            ];
            onConditionsChange(newConditions);
        }
    };

    if (isLoading) {
        return <div>Loading patterns...</div>;
    }

    if (error) {
        return <div>Error loading patterns: {error}</div>;
    }

    return (
        <div className='h-full flex flex-col space-y-4'>
            {/* Header with Info and Add Button */}
            <div className='flex gap-4 items-stretch'>
                <div className='flex-1 flex gap-2 p-3 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg'>
                    <InfoIcon className='h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0' />
                    <p className='text-blue-700 dark:text-blue-300'>
                        Conditions define how this format matches media
                        releases. Each condition can be marked as required or
                        negated. Required conditions must match for the format
                        to apply, while negated conditions must not match. Use
                        patterns to match against release titles and groups.
                    </p>
                </div>
                <button
                    onClick={handleAddCondition}
                    className='flex items-center justify-center gap-2 px-4 text-white bg-blue-600 hover:bg-blue-700 rounded-lg'>
                    <Plus className='w-5 h-5' />
                    <span className='text-sm font-medium'>Add</span>
                </button>
            </div>

            {/* Scrollable Conditions List */}
            <div className='flex-1 overflow-y-auto min-h-0'>
                <div className='space-y-3'>
                    {conditions.map((condition, index) => (
                        <ConditionCard
                            key={index}
                            condition={condition}
                            onChange={updatedCondition =>
                                handleConditionChange(index, updatedCondition)
                            }
                            onDelete={() => handleConditionDelete(index)}
                            patterns={patterns}
                            onMoveUp={() => handleMoveUp(index)}
                            onMoveDown={() => handleMoveDown(index)}
                            isFirst={index === 0}
                            isLast={index === conditions.length - 1}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

FormatConditionsTab.propTypes = {
    conditions: PropTypes.arrayOf(PropTypes.object).isRequired,
    onConditionsChange: PropTypes.func.isRequired
};

export default FormatConditionsTab;
