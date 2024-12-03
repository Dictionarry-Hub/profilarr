import React from 'react';
import PropTypes from 'prop-types';
import BrowserSelect from '@ui/BrowserSelect';

const QUALITY_MODIFIER_OPTIONS = [
    {value: 'none', label: 'None'},
    {value: 'regional', label: 'Regional'},
    {value: 'screener', label: 'Screener'},
    {value: 'rawhd', label: 'RawHD'},
    {value: 'brdisk', label: 'BRDISK'},
    {value: 'remux', label: 'REMUX'}
];

const QualityModifierCondition = ({condition, onChange}) => {
    return (
        <BrowserSelect
            value={condition.qualityModifier || ''}
            onChange={e =>
                onChange({...condition, qualityModifier: e.target.value})
            }
            options={QUALITY_MODIFIER_OPTIONS}
            placeholder='Select quality modifier...'
            className='w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                      rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
        />
    );
};

QualityModifierCondition.propTypes = {
    condition: PropTypes.shape({
        qualityModifier: PropTypes.string
    }).isRequired,
    onChange: PropTypes.func.isRequired
};

export default QualityModifierCondition;
