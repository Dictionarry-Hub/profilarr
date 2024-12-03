import React from 'react';
import PropTypes from 'prop-types';
import BrowserSelect from '@ui/BrowserSelect';
import {LANGUAGES} from '@/constants/languages';

const LanguageCondition = ({condition, onChange}) => {
    // Convert languages to options format but exclude special options
    const languageOptions = LANGUAGES.filter(lang => !lang.isSpecial) // Remove Any/Original options
        .map(lang => ({
            value: lang.id,
            label: lang.name
        }));

    return (
        <div className='flex flex-1 items-center gap-4'>
            {/* Language Selection */}
            <BrowserSelect
                value={condition.language || ''}
                onChange={e =>
                    onChange({
                        ...condition,
                        exceptLanguage: condition.exceptLanguage || false, // Ensure exceptLanguage exists
                        language: e.target.value
                    })
                }
                options={languageOptions}
                placeholder='Select language...'
                className='w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 
                          rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            />

            {/* Except Language Toggle */}
            <label className='flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap ml-auto'>
                <input
                    type='checkbox'
                    checked={condition.exceptLanguage || false}
                    onChange={e =>
                        onChange({
                            ...condition,
                            exceptLanguage: e.target.checked
                        })
                    }
                    className='rounded border-gray-300 dark:border-gray-600'
                />
                Except Language
            </label>
        </div>
    );
};

LanguageCondition.propTypes = {
    condition: PropTypes.shape({
        language: PropTypes.string,
        exceptLanguage: PropTypes.bool
    }).isRequired,
    onChange: PropTypes.func.isRequired
};

export default LanguageCondition;
