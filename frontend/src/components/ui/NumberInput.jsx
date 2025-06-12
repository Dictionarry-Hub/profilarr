import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {ChevronUp, ChevronDown} from 'lucide-react';

const NumberInput = ({
    value,
    onChange,
    className = '',
    step = 1,
    disabled = false,
    min,
    max,
    ...props
}) => {
    const [localValue, setLocalValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const displayValue = isFocused ? localValue : value.toString();

    const handleChange = e => {
        const input = e.target.value;
        if (input === '' || input === '-' || /^-?\d*$/.test(input)) {
            setLocalValue(input);
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        const numValue =
            localValue === '' || localValue === '-' ? 0 : parseInt(localValue);

        if (min !== undefined && numValue < min) {
            onChange(min);
            return;
        }
        if (max !== undefined && numValue > max) {
            onChange(max);
            return;
        }

        onChange(numValue);
    };

    const handleFocus = () => {
        setIsFocused(true);
        setLocalValue(value.toString());
    };

    const increment = () => {
        const newValue = value + step;
        if (max === undefined || newValue <= max) {
            onChange(newValue);
        }
    };

    const decrement = () => {
        const newValue = value - step;
        if (min === undefined || newValue >= min) {
            onChange(newValue);
        }
    };

    const handleKeyDown = e => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            increment();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            decrement();
        }
    };

    const inputClasses = [
        'w-full h-8 px-2 py-1 text-sm border border-gray-700',
        'rounded-l focus:outline-none text-left',
        'bg-gray-800',
        isFocused ? 'text-blue-400' : 'text-gray-300',
        '[appearance:textfield]',
        disabled && 'opacity-50 cursor-not-allowed'
    ]
        .filter(Boolean)
        .join(' ');

    const buttonContainerClasses = [
        'inline-flex flex-col border border-l-0 border-gray-700 rounded-r overflow-hidden h-8',
        'bg-gray-800',
        disabled && 'opacity-50'
    ]
        .filter(Boolean)
        .join(' ');

    const buttonClasses = [
        'flex items-center justify-center h-1/2 px-1',
        'hover:bg-gray-700',
        isFocused ? 'text-blue-400' : 'text-gray-400',
        'hover:text-gray-200 transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed'
    ].join(' ');

    return (
        <div className={`relative inline-flex ${className}`}>
            <input
                type='text'
                value={displayValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className={inputClasses}
                {...props}
            />
            <div className={buttonContainerClasses}>
                <button
                    type='button'
                    onClick={increment}
                    disabled={disabled || (max !== undefined && value >= max)}
                    className={`${buttonClasses} border-b border-gray-700`}>
                    <ChevronUp className='h-3 w-3' />
                </button>
                <button
                    type='button'
                    onClick={decrement}
                    disabled={disabled || (min !== undefined && value <= min)}
                    className={buttonClasses}>
                    <ChevronDown className='h-3 w-3' />
                </button>
            </div>
        </div>
    );
};

NumberInput.propTypes = {
    /** Current number value */
    value: PropTypes.number.isRequired,
    /** Handler called when value changes */
    onChange: PropTypes.func.isRequired,
    /** Additional classes to apply to container */
    className: PropTypes.string,
    /** Amount to increment/decrement by */
    step: PropTypes.number,
    /** Whether the input is disabled */
    disabled: PropTypes.bool,
    /** Minimum allowed value */
    min: PropTypes.number,
    /** Maximum allowed value */
    max: PropTypes.number
};

export default NumberInput;
