import React from 'react';
import PropTypes from 'prop-types';
import {Plus, InfoIcon} from 'lucide-react';
import {usePatterns} from '@hooks/usePatterns';
import {createCondition} from './conditions/conditionTypes';
import ConditionCard from './conditions/ConditionCard';

const FormatConditionsTab = ({conditions, onConditionsChange}) => {
    const {patterns, isLoading, error} = usePatterns();

    const handleAddCondition = () => {
        onConditionsChange([...conditions, createCondition()]);
    };

    const handleConditionChange = (index, updatedCondition) => {
        const newConditions = [...conditions];
        newConditions[index] = updatedCondition;
        onConditionsChange(newConditions);
    };

    const handleConditionDelete = index => {
        onConditionsChange(conditions.filter((_, i) => i !== index));
    };

    if (isLoading) {
        return <div>Loading patterns...</div>;
    }

    if (error) {
        return <div>Error loading patterns: {error}</div>;
    }

    return (
        <div className='h-full flex flex-col space-y-2'>
            {/* Info Box */}
            <div className='flex gap-2 p-3 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg'>
                <InfoIcon className='h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0' />
                <p className='text-blue-700 dark:text-blue-300'>
                    Conditions define how this format matches media releases.
                    Each condition can be marked as required or negated.
                    Required conditions must match for the format to apply,
                    while negated conditions must not match. Use patterns to
                    match against release titles and groups.
                </p>
            </div>

            {/* Existing Conditions */}
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
                    />
                ))}
            </div>

            {/* Add New Condition Card */}
            <div
                onClick={handleAddCondition}
                className='bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 
                         rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 
                         hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer'>
                <div className='flex items-center justify-center h-[38px]'>
                    <Plus className='w-5 h-5 text-gray-400 dark:text-gray-500 mr-2' />
                    <span className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                        Add New Condition
                    </span>
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
