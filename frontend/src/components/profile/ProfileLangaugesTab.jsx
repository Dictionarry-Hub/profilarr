import React from 'react';
import PropTypes from 'prop-types';
import {InfoIcon, AlertTriangle} from 'lucide-react';
import {LANGUAGES} from '@constants/languages';

const ProfileLanguagesTab = ({language, onLanguageChange}) => {
    const handleLanguageChange = (type, value) => {
        // If selecting 'any' behavior, just return 'any'
        if (type === 'behavior' && value === 'any') {
            onLanguageChange('any');
            return;
        }

        // For other cases, split current language setting
        const [behavior, lang] = (language || 'must_english').split('_');

        const newValue =
            type === 'behavior'
                ? `${value}_${lang || 'english'}`
                : `${behavior || 'must'}_${value}`;

        onLanguageChange(newValue);
    };

    // Split current language setting only if it's not 'any'
    const [currentBehavior, currentLanguage] =
        language === 'any'
            ? ['any', '']
            : (language || 'must_english').split('_');

    return (
        <div className='h-full flex flex-col'>
            <div className='bg-white dark:bg-gray-800 pb-4'>
                <div className='grid grid-cols-[auto_1fr] gap-4 items-center'>
                    <h2 className='text-xl font-semibold text-gray-900 dark:text-gray-100 leading-tight'>
                        Language Requirements
                    </h2>
                    <p className='text-xs text-gray-600 dark:text-gray-400 leading-relaxed'>
                        Configure language requirements for media content.
                    </p>
                </div>
            </div>

            <div className='mt-4 space-y-4'>
                <div className='flex gap-2 p-3 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg'>
                    <InfoIcon className='h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0' />
                    <p className='text-blue-700 dark:text-blue-300'>
                        Configure how languages should be handled for your media
                        content. Select "Any" to accept all languages, or
                        configure specific language requirements.
                    </p>
                </div>

                <div className='p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'>
                    <div className='space-y-3'>
                        <div className='space-y-1'>
                            <h3 className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                                Language Settings
                            </h3>
                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                                Configure language requirements for releases
                            </p>
                        </div>

                        <div className='grid grid-cols-2 gap-3'>
                            <select
                                value={currentBehavior}
                                onChange={e =>
                                    handleLanguageChange(
                                        'behavior',
                                        e.target.value
                                    )
                                }
                                className='block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400'>
                                <option value='any'>Any</option>
                                <option value='must'>Must Include</option>
                                <option value='only'>Must Only Be</option>
                                <option value='mustnot'>
                                    Must Not Include
                                </option>
                            </select>

                            {currentBehavior !== 'any' && (
                                <select
                                    value={currentLanguage || 'english'}
                                    onChange={e =>
                                        handleLanguageChange(
                                            'language',
                                            e.target.value
                                        )
                                    }
                                    className='block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400'>
                                    {LANGUAGES.map(language => (
                                        <option
                                            key={language.id}
                                            value={language.id}>
                                            {language.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {currentBehavior === 'only' && (
                            <div className='flex items-center gap-1.5 mt-2'>
                                <AlertTriangle className='h-3 w-3 text-amber-500' />
                                <p className='text-[10px] text-amber-600 dark:text-amber-400'>
                                    "Must Only Be" will reject releases with
                                    multiple languages
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

ProfileLanguagesTab.propTypes = {
    language: PropTypes.string.isRequired,
    onLanguageChange: PropTypes.func.isRequired
};

export default ProfileLanguagesTab;
