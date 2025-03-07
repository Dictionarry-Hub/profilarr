import React from 'react';
import PropTypes from 'prop-types';
import {InfoIcon, AlertTriangle} from 'lucide-react';
import {LANGUAGES} from '@constants/languages';

const AdvancedView = ({language, onLanguageChange}) => {
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
        <>
            {/* Type Dropdown */}
            <select
                value={currentBehavior}
                onChange={e =>
                    handleLanguageChange('behavior', e.target.value)
                }
                className='flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400'>
                <option value='any'>Any</option>
                <option value='must'>Must Include</option>
                <option value='only'>Must Only Be</option>
                <option value='mustnot'>Must Not Include</option>
            </select>

            {/* Language Dropdown */}
            {currentBehavior !== 'any' && (
                <select
                    value={currentLanguage || 'english'}
                    onChange={e =>
                        handleLanguageChange(
                            'language',
                            e.target.value
                        )
                    }
                    className='flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400'>
                    {LANGUAGES.map(language => (
                        <option
                            key={language.id}
                            value={language.id}>
                            {language.name}
                        </option>
                    ))}
                </select>
            )}

            {/* Help text below the controls is in the parent component */}

            <div>
                {currentBehavior === 'any' && (
                    <div className='flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400'>
                        <InfoIcon className='h-3.5 w-3.5 text-blue-500 flex-shrink-0' />
                        <p>Accept content in any language.</p>
                    </div>
                )}

                {currentBehavior === 'must' && (
                    <div className='flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400'>
                        <InfoIcon className='h-3.5 w-3.5 text-blue-500 flex-shrink-0' />
                        <p>
                            Content must include{' '}
                            {currentLanguage
                                ? LANGUAGES.find(
                                      l => l.id === currentLanguage
                                  )?.name || currentLanguage
                                : 'English'}
                            , but can include other languages as well.
                        </p>
                    </div>
                )}

                {currentBehavior === 'only' && (
                    <div className='flex items-center gap-1.5 text-xs'>
                        <AlertTriangle className='h-3.5 w-3.5 text-amber-500 flex-shrink-0' />
                        <p className='text-amber-600 dark:text-amber-400'>
                            Content must ONLY be in{' '}
                            {currentLanguage
                                ? LANGUAGES.find(
                                      l => l.id === currentLanguage
                                  )?.name || currentLanguage
                                : 'English'}
                            . This will reject releases containing
                            multiple languages.
                        </p>
                    </div>
                )}

                {currentBehavior === 'mustnot' && (
                    <div className='flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400'>
                        <InfoIcon className='h-3.5 w-3.5 text-blue-500 flex-shrink-0' />
                        <p>
                            Content must NOT include{' '}
                            {currentLanguage
                                ? LANGUAGES.find(
                                      l => l.id === currentLanguage
                                  )?.name || currentLanguage
                                : 'English'}
                            . Any other language is acceptable.
                        </p>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
};

AdvancedView.propTypes = {
    language: PropTypes.string.isRequired,
    onLanguageChange: PropTypes.func.isRequired
};

export default AdvancedView;
