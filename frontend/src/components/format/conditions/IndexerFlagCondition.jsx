import React from 'react';
import PropTypes from 'prop-types';
import BrowserSelect from '@ui/BrowserSelect';

const INDEXER_FLAGS = [
    {value: 'freeleech', label: 'Freeleech'},
    {value: 'halfleech', label: 'Halfleech'},
    {value: 'double_upload', label: 'Double Upload'},
    {value: 'internal', label: 'Internal'},
    {value: 'scene', label: 'Scene'},
    {value: 'freeleech_75', label: 'Freeleech 75%'},
    {value: 'freeleech_25', label: 'Freeleech 25%'},
    {value: 'nuked', label: 'Nuked'},
    {value: 'ptp_golden', label: 'PTP Golden (Radarr only)'},
    {value: 'ptp_approved', label: 'PTP Approved (Radarr only)'}
];

const IndexerFlagCondition = ({condition, onChange}) => {
    return (
        <BrowserSelect
            value={condition.flag || ''}
            onChange={e => onChange({...condition, flag: e.target.value})}
            options={INDEXER_FLAGS}
            placeholder='Select an indexer flag...'
            className='w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                      rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
        />
    );
};

IndexerFlagCondition.propTypes = {
    condition: PropTypes.shape({
        flag: PropTypes.string // Indexer flag selection
    }).isRequired,
    onChange: PropTypes.func.isRequired
};

export default IndexerFlagCondition;
