import React from 'react';
import PropTypes from 'prop-types';
import RcSlider from 'rc-slider';
import 'rc-slider/assets/index.css';

const CustomSlider = ({ min = 0, max = 2000, minValue, preferredValue, maxValue, onChange, disabled = false }) => {
    const handleChange = (values) => {
        const minGap = 10;
        let [newMin, newPreferred, newMax] = values;
        
        // Ensure minimum gaps between handles
        if (newPreferred - newMin < minGap) {
            newPreferred = newMin + minGap;
        }
        if (newMax - newPreferred < minGap) {
            newMax = newPreferred + minGap;
        }
        
        // Ensure we don't exceed bounds
        if (newMax > max) {
            newMax = max;
            newPreferred = Math.min(newPreferred, newMax - minGap);
            newMin = Math.min(newMin, newPreferred - minGap);
        }
        
        onChange({
            min: newMin,
            preferred: newPreferred,
            max: newMax
        });
    };

    return (
        <div className={`w-full ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
            <RcSlider
                range
                min={min}
                max={max}
                value={[minValue || 0, preferredValue || 0, maxValue || 0]}
                onChange={handleChange}
                disabled={disabled}
                allowCross={false}
                pushable={10}
                trackStyle={[
                    { backgroundColor: '#3b82f6', opacity: 0.3 },
                    { backgroundColor: '#3b82f6', opacity: 0.6 }
                ]}
                handleStyle={[
                    { backgroundColor: '#3b82f6', border: 'none', opacity: disabled ? 0.5 : 1 },
                    { backgroundColor: '#10b981', border: 'none', opacity: disabled ? 0.5 : 1 },
                    { backgroundColor: '#ef4444', border: 'none', opacity: disabled ? 0.5 : 1 }
                ]}
                railStyle={{ backgroundColor: 'oklch(13% 0.028 261.692 / 0.5)' }}
                dotStyle={{ backgroundColor: '#6b7280', borderColor: '#9ca3af' }}
                activeDotStyle={{ backgroundColor: '#3b82f6', borderColor: '#60a5fa' }}
            />
        </div>
    );
};

CustomSlider.propTypes = {
    min: PropTypes.number,
    max: PropTypes.number,
    minValue: PropTypes.number.isRequired,
    preferredValue: PropTypes.number.isRequired,
    maxValue: PropTypes.number.isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool
};

export default CustomSlider;