import React from 'react';
import PropTypes from 'prop-types';

const MonospaceInput = ({
    value,
    onChange,
    placeholder,
    disabled = false,
    rows = 1,
    className = '',
    ...props
}) => {
    const baseClasses = `
        w-full px-4 py-2.5
        bg-gray-900/50
        border border-gray-700/50
        rounded
        font-mono text-[13px]
        transition-all duration-200
        outline-none
    `;

    const stateClasses = disabled
        ? 'text-gray-500 cursor-not-allowed opacity-60'
        : `text-gray-200
           hover:border-gray-600 hover:bg-gray-900/70
           focus:bg-gray-900 focus:border-blue-400 focus:outline-none focus-visible:outline-none
           placeholder:text-gray-600`;

    const combinedClasses = `${baseClasses} ${stateClasses} ${className}`;

    if (rows > 1) {
        return (
            <textarea
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
                spellCheck={false}
                className={`${combinedClasses} resize-none whitespace-nowrap overflow-x-auto overflow-y-hidden scrollbar-hide`}
                style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                    height: `${rows * 1.5}em`,
                    minHeight: 'unset',
                    maxHeight: `${rows * 1.5}em`
                }}
                wrap="off"
                {...props}
            />
        );
    }

    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            spellCheck={false}
            className={combinedClasses}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}
            {...props}
        />
    );
};

MonospaceInput.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func,
    placeholder: PropTypes.string,
    disabled: PropTypes.bool,
    rows: PropTypes.number,
    className: PropTypes.string
};

export default MonospaceInput;