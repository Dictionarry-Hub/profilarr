import React from 'react';
import PropTypes from 'prop-types';
import NumberInput from '../ui/NumberInput';
import Slider from '../ui/Slider';

const QualityItem = ({ name, settings, onChange, disabled = false }) => {
    const handleInputChange = (field, value) => {
        const numValue = parseInt(value) || 0;
        onChange({
            ...settings,
            [field]: numValue
        });
    };

    const handleSliderChange = (values) => {
        onChange({
            min: values.min,
            preferred: values.preferred,
            max: values.max
        });
    };

    return (
        <tr className="border-b border-gray-700/50 last:border-b-0 hover:bg-gray-800/20 transition-colors">
            {/* Quality Name */}
            <td className="pl-4 pr-6 py-3">
                <span 
                    className="inline-block px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 rounded-full text-xs font-medium text-gray-200 font-mono"
                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}
                >
                    {name}
                </span>
            </td>

            {/* Slider Section */}
            <td className="px-4 py-3">
                <Slider
                    min={0}
                    max={2000}
                    minValue={settings.min || 0}
                    preferredValue={settings.preferred || 0}
                    maxValue={settings.max || 0}
                    onChange={handleSliderChange}
                    disabled={disabled}
                />
            </td>

            {/* Min Input */}
            <td className="px-2 py-3">
                <NumberInput
                    value={settings.min || 0}
                    onChange={(value) => handleInputChange('min', value)}
                    min={0}
                    max={2000}
                    disabled={disabled}
                />
            </td>

            {/* Preferred Input */}
            <td className="px-2 py-3">
                <NumberInput
                    value={settings.preferred || 0}
                    onChange={(value) => handleInputChange('preferred', value)}
                    min={0}
                    max={2000}
                    disabled={disabled}
                />
            </td>

            {/* Max Input */}
            <td className="px-2 py-3">
                <NumberInput
                    value={settings.max || 0}
                    onChange={(value) => handleInputChange('max', value)}
                    min={0}
                    max={2000}
                    disabled={disabled}
                />
            </td>
        </tr>
    );
};

QualityItem.propTypes = {
    name: PropTypes.string.isRequired,
    settings: PropTypes.shape({
        min: PropTypes.number,
        preferred: PropTypes.number,
        max: PropTypes.number
    }).isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool
};

export default QualityItem;