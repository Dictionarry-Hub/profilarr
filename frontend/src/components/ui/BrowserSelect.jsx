import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import CustomDropdown from './CustomDropdown';

const BrowserSelect = ({value, onChange, options, placeholder, className}) => {
    const [isChromium, setIsChromium] = useState(false);

    useEffect(() => {
        // Check if browser is Chromium-based
        const isChromiumBased =
            !!window.chrome &&
            (navigator.userAgent.includes('Chrome') ||
                navigator.userAgent.includes('Edge') ||
                navigator.userAgent.includes('Opera'));

        setIsChromium(isChromiumBased);
    }, []);

    if (isChromium) {
        return (
            <CustomDropdown
                value={value}
                onChange={onChange}
                options={options}
                placeholder={placeholder}
            />
        );
    }

    // Default native select for Firefox and others
    return (
        <select value={value} onChange={onChange} className={className}>
            {placeholder && (
                <option value='' disabled>
                    {placeholder}
                </option>
            )}
            {options.map(option => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
};

BrowserSelect.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired
        })
    ).isRequired,
    placeholder: PropTypes.string,
    className: PropTypes.string
};

export default BrowserSelect;
