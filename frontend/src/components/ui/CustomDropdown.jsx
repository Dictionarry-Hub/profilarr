import React, {useState, useRef, useEffect} from 'react';
import {ChevronDown} from 'lucide-react';
import PropTypes from 'prop-types';

const CustomDropdown = ({value, onChange, options, placeholder}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState(
        options.find(opt => opt.value === value) || null
    );
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = event => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = option => {
        setSelectedOption(option);
        onChange({target: {value: option.value}});
        setIsOpen(false);
    };

    return (
        <div className='relative' ref={dropdownRef}>
            {/* Dropdown Button */}
            <button
                type='button'
                onClick={() => setIsOpen(!isOpen)}
                className='w-full flex items-center justify-between px-3 py-2 text-sm 
                 bg-gray-700 border border-gray-600 rounded-md
                 text-gray-100 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'>
                <span>
                    {selectedOption?.label || placeholder || 'Select option...'}
                </span>
                <ChevronDown
                    className={`w-4 h-4 ml-2 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className='absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg'>
                    <div className='py-1 max-h-60 overflow-auto scrollable'>
                        {options.map(option => (
                            <div
                                key={option.value}
                                onClick={() => handleSelect(option)}
                                className={`px-3 py-2 text-sm cursor-pointer
                         ${
                             selectedOption?.value === option.value
                                 ? 'bg-blue-600 text-white'
                                 : 'text-gray-100 hover:bg-gray-600'
                         }`}>
                                {option.label}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

CustomDropdown.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired
        })
    ).isRequired,
    placeholder: PropTypes.string
};

export default CustomDropdown;
