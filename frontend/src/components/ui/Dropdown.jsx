import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';

const Dropdown = ({
    value,
    onChange,
    options = [],
    placeholder = 'Select an option',
    disabled = false,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (option) => {
        onChange({ target: { value: option.value } });
        setIsOpen(false);
    };

    const baseClasses = `
        relative w-full px-4 py-2.5 
        bg-gray-900/50 
        border border-gray-700/50 
        rounded 
        text-[13px] text-left
        transition-all duration-200
        flex items-center justify-between
        cursor-pointer
        outline-none
    `;

    const stateClasses = disabled
        ? 'text-gray-500 cursor-not-allowed opacity-60'
        : `text-gray-200 
           hover:border-gray-600 hover:bg-gray-900/70
           focus:bg-gray-900 focus:border-blue-400 focus:outline-none
           placeholder:text-gray-600`;

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`${baseClasses} ${stateClasses} ${className}`}
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}
                disabled={disabled}
            >
                <span className={!selectedOption ? 'text-gray-400' : ''}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown 
                    className={`w-4 h-4 transition-transform duration-200 ${
                        isOpen ? 'transform rotate-180' : ''
                    } ${disabled ? 'text-gray-600' : 'text-gray-400'}`}
                />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-gray-800 dark:bg-gray-800 border border-gray-600 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSelect(option)}
                            className={`
                                w-full px-3 py-2 text-left text-sm
                                transition-colors duration-150
                                ${option.value === value 
                                    ? 'bg-blue-600/20 text-blue-400' 
                                    : 'text-gray-100 dark:text-gray-100 hover:bg-gray-700 dark:hover:bg-gray-700'
                                }
                            `}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

Dropdown.propTypes = {
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onChange: PropTypes.func.isRequired,
    options: PropTypes.arrayOf(PropTypes.shape({
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        label: PropTypes.string.isRequired
    })).isRequired,
    placeholder: PropTypes.string,
    disabled: PropTypes.bool,
    className: PropTypes.string
};

export default Dropdown;