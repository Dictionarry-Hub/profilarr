import React from 'react';
import PropTypes from 'prop-types';
import BrowserSelect from '@ui/BrowserSelect';

const RESOLUTION_OPTIONS = [
    {value: '360p', label: '360p'},
    {value: '480p', label: '480p'},
    {value: '540p', label: '540p'},
    {value: '576p', label: '576p'},
    {value: '720p', label: '720p'},
    {value: '1080p', label: '1080p'},
    {value: '2160p', label: '2160p'}
];

const ResolutionCondition = ({condition, onChange}) => {
    return (
        <BrowserSelect
            value={condition.resolution || ''}
            onChange={e => onChange({...condition, resolution: e.target.value})}
            options={RESOLUTION_OPTIONS}
            placeholder='Select resolution...'
            className='w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                      rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
        />
    );
};

ResolutionCondition.propTypes = {
    condition: PropTypes.shape({
        resolution: PropTypes.string
    }).isRequired,
    onChange: PropTypes.func.isRequired
};

export default ResolutionCondition;
