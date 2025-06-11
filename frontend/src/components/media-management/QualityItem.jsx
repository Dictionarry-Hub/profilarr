import React from 'react';
import PropTypes from 'prop-types';
import NumberInput from '../ui/NumberInput';
import Slider from '../ui/Slider';

const QualityItem = ({ name, settings, arrType, onChange, disabled = false }) => {
    const handleInputChange = (field, value) => {
        let numValue = parseInt(value) || 0;
        
        // Validate and clamp values based on field
        if (field === 'min') {
            // Min must be >= 0
            numValue = Math.max(0, numValue);
            // Min cannot exceed max - 20 (to leave room for preferred)
            if (settings.max) {
                numValue = Math.min(numValue, settings.max - 20);
            }
        } else if (field === 'preferred') {
            // Preferred must be at least min + 10
            if (settings.min !== undefined) {
                numValue = Math.max(settings.min + 10, numValue);
            }
            // Preferred must be at most max - 10
            if (settings.max !== undefined) {
                numValue = Math.min(settings.max - 10, numValue);
            }
        } else if (field === 'max') {
            // Max cannot exceed the arr type limit
            numValue = Math.min(numValue, maxValue);
            // Max must be at least min + 20 (to leave room for preferred)
            if (settings.min !== undefined) {
                numValue = Math.max(settings.min + 20, numValue);
            }
        }
        
        // Create updated settings
        const updatedSettings = {
            ...settings,
            [field]: numValue
        };
        
        // If we changed min or max, we might need to adjust preferred
        if (field === 'min' || field === 'max') {
            const currentPreferred = updatedSettings.preferred || 0;
            const minPreferred = (updatedSettings.min || 0) + 10;
            const maxPreferred = (updatedSettings.max || maxValue) - 10;
            
            if (currentPreferred < minPreferred) {
                updatedSettings.preferred = minPreferred;
            } else if (currentPreferred > maxPreferred) {
                updatedSettings.preferred = maxPreferred;
            }
        }
        
        onChange(updatedSettings);
    };

    const handleSliderChange = (values) => {
        // Apply the same validation as input changes
        let { min, preferred, max } = values;
        
        // Clamp min to valid range
        min = Math.max(0, Math.min(min, maxValue - 20));
        
        // Clamp max to valid range
        max = Math.max(min + 20, Math.min(max, maxValue));
        
        // Clamp preferred to valid range
        preferred = Math.max(min + 10, Math.min(preferred, max - 10));
        
        onChange({
            min,
            preferred,
            max
        });
    };

    // Set max value based on arr type
    const maxValue = arrType === 'sonarr' ? 1000 : 2000;

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
                    max={maxValue}
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
                    max={maxValue}
                    disabled={disabled}
                />
            </td>

            {/* Preferred Input */}
            <td className="px-2 py-3">
                <NumberInput
                    value={settings.preferred || 0}
                    onChange={(value) => handleInputChange('preferred', value)}
                    min={0}
                    max={maxValue}
                    disabled={disabled}
                />
            </td>

            {/* Max Input */}
            <td className="px-2 py-3">
                <NumberInput
                    value={settings.max || 0}
                    onChange={(value) => handleInputChange('max', value)}
                    min={0}
                    max={maxValue}
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
    arrType: PropTypes.oneOf(['radarr', 'sonarr']).isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool
};

export default QualityItem;