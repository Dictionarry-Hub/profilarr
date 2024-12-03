import React from 'react';
import PropTypes from 'prop-types';
import BrowserSelect from '@ui/BrowserSelect';

const RELEASE_TYPE_OPTIONS = [
    {value: 'single_episode', label: 'Single Episode'},
    {value: 'multi_episode', label: 'Multi Episode'},
    {value: 'season_pack', label: 'Season Pack'}
];

const ReleaseTypeCondition = ({condition, onChange}) => {
    return (
        <BrowserSelect
            value={condition.releaseType || ''}
            onChange={e =>
                onChange({...condition, releaseType: e.target.value})
            }
            options={RELEASE_TYPE_OPTIONS}
            placeholder='Select release type...'
            className='w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                      rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
        />
    );
};

ReleaseTypeCondition.propTypes = {
    condition: PropTypes.shape({
        releaseType: PropTypes.string
    }).isRequired,
    onChange: PropTypes.func.isRequired
};

export default ReleaseTypeCondition;
