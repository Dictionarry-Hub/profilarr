import React from 'react';
import PropTypes from 'prop-types';
import {InfoIcon} from 'lucide-react';
import {usePatterns} from '@hooks/usePatterns';
import {createCondition} from './conditions/conditionTypes';
import ConditionCard from './conditions/ConditionCard';
import AddButton from '@ui/DataBar/AddButton';

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

    const handleMoveToTop = index => {
        if (index > 0) {
            const newConditions = [...conditions];
            const [movedCondition] = newConditions.splice(index, 1);
            newConditions.unshift(movedCondition);
            onConditionsChange(newConditions);
        }
    };

    const handleMoveToBottom = index => {
        if (index < conditions.length - 1) {
            const newConditions = [...conditions];
            const [movedCondition] = newConditions.splice(index, 1);
            newConditions.push(movedCondition);
            onConditionsChange(newConditions);
        }
    };

    if (isLoading) {
        return (
            <div className='flex items-center justify-center h-full'>
                <div className='text-gray-500 dark:text-gray-400'>
                    Loading patterns...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className='flex items-center justify-center h-full'>
                <div className='text-red-500 dark:text-red-400'>
                    Error loading patterns: {error}
                </div>
            </div>
        );
    }

    return (
        <div className='h-full flex flex-col space-y-4'>
            {/* Header Section */}
            <div className='flex items-center gap-4 h-16'>
                {/* Info Alert */}
                <div
                    className='flex-1 flex items-center gap-2 px-3 py-2 
                    bg-blue-50 dark:bg-blue-900/20 
                    border border-blue-200 dark:border-blue-800 
                    rounded-md'>
                    <InfoIcon className='h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0' />
                    <p className='text-sm text-blue-700 dark:text-blue-300'>
                        Define matching rules using required and negated
                        conditions to control how formats are applied to media
                        releases.
                    </p>
                </div>

                {/* Add Button */}
                <AddButton onClick={handleAddCondition} label='Add Condition' />
            </div>

            {/* Scrollable Conditions List */}
            <div className='flex-1 overflow-y-auto min-h-0 scrollable pr-2'>
                <div className='space-y-3 pb-4'>
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
                            onMoveToTop={() => handleMoveToTop(index)}
                            onMoveToBottom={() => handleMoveToBottom(index)}
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
