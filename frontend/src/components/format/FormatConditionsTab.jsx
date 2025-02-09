import React, {useCallback, useRef, useEffect} from 'react';
import PropTypes from 'prop-types';
import {InfoIcon} from 'lucide-react';
import {usePatterns} from '@hooks/usePatterns';
import {createCondition} from './conditions/conditionTypes';
import ConditionCard from './conditions/ConditionCard';
import AddButton from '@ui/DataBar/AddButton';

const FormatConditionsTab = ({conditions, onConditionsChange}) => {
    const {patterns, isLoading, error} = usePatterns();
    const scrollContainerRef = useRef(null);
    const previousConditionsLength = useRef(conditions.length);

    // Effect to handle scrolling when conditions are added
    useEffect(() => {
        if (conditions.length > previousConditionsLength.current) {
            // Scroll to bottom with smooth animation
            scrollContainerRef.current?.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
        previousConditionsLength.current = conditions.length;
    }, [conditions.length]);

    // Memoized handler for adding conditions
    const handleAddCondition = useCallback(() => {
        const newCondition = createCondition();
        // Append to end and create a new array reference
        onConditionsChange(currentConditions => [
            ...currentConditions,
            newCondition
        ]);
    }, [onConditionsChange]);

    // Memoized handler for condition updates
    const handleConditionChange = useCallback(
        (index, updatedCondition) => {
            onConditionsChange(currentConditions => {
                const newConditions = [...currentConditions];
                newConditions[index] = {...updatedCondition}; // Create new reference
                return newConditions;
            });
        },
        [onConditionsChange]
    );

    // Memoized handler for condition deletion
    const handleConditionDelete = useCallback(
        index => {
            onConditionsChange(currentConditions =>
                currentConditions.filter((_, i) => i !== index)
            );
        },
        [onConditionsChange]
    );

    // Memoized movement handlers
    const handleMoveUp = useCallback(
        index => {
            if (index > 0) {
                onConditionsChange(currentConditions => {
                    const newConditions = [...currentConditions];
                    [newConditions[index - 1], newConditions[index]] = [
                        {...newConditions[index]},
                        {...newConditions[index - 1]}
                    ];
                    return newConditions;
                });
            }
        },
        [onConditionsChange]
    );

    const handleMoveDown = useCallback(
        index => {
            onConditionsChange(currentConditions => {
                if (index < currentConditions.length - 1) {
                    const newConditions = [...currentConditions];
                    [newConditions[index], newConditions[index + 1]] = [
                        {...newConditions[index + 1]},
                        {...newConditions[index]}
                    ];
                    return newConditions;
                }
                return currentConditions;
            });
        },
        [onConditionsChange]
    );

    const handleMoveToTop = useCallback(
        index => {
            if (index > 0) {
                onConditionsChange(currentConditions => {
                    const newConditions = [...currentConditions];
                    const [movedCondition] = newConditions.splice(index, 1);
                    return [{...movedCondition}, ...newConditions];
                });
            }
        },
        [onConditionsChange]
    );

    const handleMoveToBottom = useCallback(
        index => {
            onConditionsChange(currentConditions => {
                if (index < currentConditions.length - 1) {
                    const newConditions = [...currentConditions];
                    const [movedCondition] = newConditions.splice(index, 1);
                    return [...newConditions, {...movedCondition}];
                }
                return currentConditions;
            });
        },
        [onConditionsChange]
    );

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
            <div className='flex items-center gap-4 h-16'>
                <div className='flex-1 flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md'>
                    <InfoIcon className='h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0' />
                    <p className='text-sm text-blue-700 dark:text-blue-300'>
                        Define matching rules using required and negated
                        conditions to control how formats are applied to media
                        releases.
                    </p>
                </div>
                <AddButton onClick={handleAddCondition} label='Add Condition' />
            </div>

            <div
                ref={scrollContainerRef}
                className='flex-1 overflow-y-auto min-h-0 scrollable pr-2'>
                <div className='space-y-3 pb-4'>
                    {conditions.map((condition, index) => (
                        <ConditionCard
                            key={`condition-${index}`}
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
