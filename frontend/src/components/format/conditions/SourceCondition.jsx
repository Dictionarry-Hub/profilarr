import React from 'react';
import PropTypes from 'prop-types';
import BrowserSelect from '@ui/BrowserSelect';

const SOURCE_OPTIONS = [
    {value: 'unknown', label: 'Unknown'},
    {value: 'television', label: 'Television'},
    {value: 'television_raw', label: 'Television Raw (Sonarr Only)'},
    {value: 'web_dl', label: 'WEB-DL'},
    {value: 'webrip', label: 'WEBRip'},
    {value: 'dvd', label: 'DVD'},
    {value: 'bluray', label: 'Bluray'},
    {value: 'bluray_raw', label: 'Bluray Raw (Sonarr Only)'},
    {value: 'cam', label: 'Cam (Radarr Only)'},
    {value: 'telesync', label: 'Telesync (Radarr Only)'},
    {value: 'telecine', label: 'Telecine (Radarr Only)'},
    {value: 'workprint', label: 'Workprint (Radarr Only)'}
];

const SourceCondition = ({condition, onChange}) => {
    return (
        <BrowserSelect
            value={condition.source || ''}
            onChange={e => onChange({...condition, source: e.target.value})}
            options={SOURCE_OPTIONS}
            placeholder='Select source...'
            className='w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                      rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
        />
    );
};

SourceCondition.propTypes = {
    condition: PropTypes.shape({
        source: PropTypes.string
    }).isRequired,
    onChange: PropTypes.func.isRequired
};

export default SourceCondition;
