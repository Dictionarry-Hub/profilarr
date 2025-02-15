import React, {useState, useRef, useEffect} from 'react';
import PropTypes from 'prop-types';
import {ChevronUp, ChevronDown} from 'lucide-react';

const Sort = ({options, value, onChange}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [field, direction] = value.split('-');

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = newField => {
        if (newField === field) {
            onChange(`${field}-${direction === 'asc' ? 'desc' : 'asc'}`);
        } else {
            onChange(`${newField}-desc`);
        }
        setIsOpen(false);
    };

    return (
        <div className='relative inline-block text-left' ref={dropdownRef}>
            <div
                className='inline-flex items-center gap-1.5 px-2.5 h-8 bg-white dark:bg-gray-800 border 
            border-gray-200 dark:border-gray-700 rounded-md'>
                {direction === 'asc' ? (
                    <ChevronUp size={14} className='text-gray-500' />
                ) : (
                    <ChevronDown size={14} className='text-gray-500' />
                )}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className='bg-transparent border-none focus:ring-0 text-gray-600 dark:text-gray-300 
                    text-sm py-0 pl-0 pr-6'>
                    {options.find(option => option.value === field)?.label}
                </button>
            </div>

            {isOpen && (
                <div className='absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 border border-gray-200 dark:border-gray-700'>
                    <div className='py-1'>
                        {options.map(option => (
                            <button
                                key={option.value}
                                onClick={() => handleChange(option.value)}
                                className='block w-full text-left px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'>
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

Sort.propTypes = {
    options: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string.isRequired,
            value: PropTypes.string.isRequired
        })
    ).isRequired,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
};

export default Sort;
