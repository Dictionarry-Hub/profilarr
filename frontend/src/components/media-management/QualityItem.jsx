import React from 'react';
import PropTypes from 'prop-types';
import NumberInput from '../ui/NumberInput';
import Slider from '../ui/Slider';

const QualityItem = ({ name, settings, arrType, viewMode, convertValue, convertBack, onChange, disabled = false }) => {
    const handleInputChange = (field, value) => {
        // Convert display value back to MB/min
        let numValue = convertBack(value);
        
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
    
    // Convert values for display
    const displayMin = convertValue(settings.min || 0);
    const displayPreferred = convertValue(settings.preferred || 0);
    const displayMax = convertValue(settings.max || 0);
    const displayMaxLimit = convertValue(maxValue);

    // Mobile layout
    const [isMobile, setIsMobile] = React.useState(false);
    
    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (isMobile) {
        return (
            <tr className="border-b border-gray-700/50 last:border-b-0">
                <td colSpan="5" className="px-4 py-3">
                    <div className="space-y-2">
                        {/* Quality name */}
                        <div>
                            <span 
                                className="inline-block px-2 py-1 bg-gray-800/60 border border-gray-700/50 rounded-full text-xs font-medium text-gray-200 font-mono"
                                style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace' }}
                            >
                                {name}
                            </span>
                        </div>
                        
                        {/* Slider */}
                        <div className="w-full">
                            <Slider
                                min={0}
                                max={maxValue}
                                minValue={settings.min || 0}
                                preferredValue={settings.preferred || 0}
                                maxValue={settings.max || 0}
                                onChange={handleSliderChange}
                                disabled={disabled}
                            />
                        </div>
                        
                        {/* Number inputs row */}
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Min</label>
                                <NumberInput
                                    value={displayMin}
                                    onChange={(value) => handleInputChange('min', value)}
                                    min={0}
                                    max={displayMaxLimit}
                                    disabled={disabled}
                                    step={viewMode === 'mbps' ? 0.1 : (viewMode === 'mbPerMin' ? 1 : 0.01)}
                                    className="text-xs"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Preferred</label>
                                <NumberInput
                                    value={displayPreferred}
                                    onChange={(value) => handleInputChange('preferred', value)}
                                    min={0}
                                    max={displayMaxLimit}
                                    disabled={disabled}
                                    step={viewMode === 'mbps' ? 0.1 : (viewMode === 'mbPerMin' ? 1 : 0.01)}
                                    className="text-xs"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Max</label>
                                <NumberInput
                                    value={displayMax}
                                    onChange={(value) => handleInputChange('max', value)}
                                    min={0}
                                    max={displayMaxLimit}
                                    disabled={disabled}
                                    step={viewMode === 'mbps' ? 0.1 : (viewMode === 'mbPerMin' ? 1 : 0.01)}
                                    className="text-xs"
                                />
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        );
    }

    // Desktop layout
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
                <div className="w-20">
                    <NumberInput
                        value={displayMin}
                        onChange={(value) => handleInputChange('min', value)}
                        min={0}
                        max={displayMaxLimit}
                        disabled={disabled}
                        step={viewMode === 'mbps' ? 0.1 : (viewMode === 'mbPerMin' ? 1 : 0.01)}
                    />
                </div>
            </td>

            {/* Preferred Input */}
            <td className="px-2 py-3">
                <div className="w-20">
                    <NumberInput
                        value={displayPreferred}
                        onChange={(value) => handleInputChange('preferred', value)}
                        min={0}
                        max={displayMaxLimit}
                        disabled={disabled}
                        step={viewMode === 'mbps' ? 0.1 : (viewMode === 'mbPerMin' ? 1 : 0.01)}
                    />
                </div>
            </td>

            {/* Max Input */}
            <td className="px-2 py-3">
                <div className="w-20">
                    <NumberInput
                        value={displayMax}
                        onChange={(value) => handleInputChange('max', value)}
                        min={0}
                        max={displayMaxLimit}
                        disabled={disabled}
                        step={viewMode === 'mbps' ? 0.1 : (viewMode === 'mbPerMin' ? 1 : 0.01)}
                    />
                </div>
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
    viewMode: PropTypes.string.isRequired,
    convertValue: PropTypes.func.isRequired,
    convertBack: PropTypes.func.isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool
};

export default QualityItem;