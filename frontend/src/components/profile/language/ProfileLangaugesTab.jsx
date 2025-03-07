import React, {useState, useEffect, useMemo} from 'react';
import PropTypes from 'prop-types';
import {
    Settings,
    List,
    ChevronDown,
    InfoIcon,
    AlertTriangle
} from 'lucide-react';
import {LANGUAGES} from '@constants/languages';
import SearchDropdown from '@ui/SearchDropdown';

const ProfileLanguagesTab = ({language, onLanguageChange}) => {
    // Determine advanced view based on language format
    const [isAdvancedView, setIsAdvancedView] = useState(() => {
        // If language includes an underscore (e.g., must_english) or doesn't exist, it's advanced mode
        // If it's a simple language ID without underscore (e.g., english, original, any), it's simple mode
        return !language || language.includes('_');
    });

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Update mode whenever language changes externally
    useEffect(() => {
        // If no language provided, set a default value for new profiles
        if (!language) {
            // Default for new profiles: Advanced mode with "must include original"
            onLanguageChange('must_original');
        } else {
            // Otherwise determine mode from language format
            setIsAdvancedView(!language || language.includes('_'));
        }
    }, [language, onLanguageChange]);

    // For simple view - language options
    const languageOptions = useMemo(() => {
        return [
            // Any language at the very top - special item
            {
                value: 'any',
                label: 'Any Language',
                description: 'Accepting content in any language',
                isSpecial: true
            },
            // Original language next - special item
            {
                value: 'original',
                label: 'Original',
                description:
                    'Content must include Original, but can include other languages as well',
                isSpecial: true
            },
            // All other languages - sorted alphabetically
            ...LANGUAGES.filter(lang => lang.id !== 'original') // Skip original since we added it manually above
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(lang => ({
                    value: lang.id,
                    label: lang.name,
                    description: `Content must include ${lang.name}, but can include other languages as well`
                }))
        ];
    }, []);

    // For advanced view - handle language changes
    const handleAdvancedLanguageChange = (type, value) => {
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
        <div className='w-full space-y-6'>
            <div className='space-y-4'>
                {/* Simple header with title and description */}
                <div className='mb-4'>
                    <h2 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                        Language Settings
                    </h2>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                        Configure how language preferences are applied to your
                        profiles.
                        {isAdvancedView
                            ? ' Advanced mode creates custom formats for precise language control in both Radarr and Sonarr. This is required for Sonarr as it lacks built-in language settings.'
                            : ' Simple mode sets language preferences directly in Radarr without custom formats. For Sonarr, consider using Advanced mode since it has no built-in language filtering.'}
                    </p>
                </div>

                {/* Controls row - display mode dropdown with other controls */}
                <div className='flex gap-3'>
                    {/* Mode Selector (always visible) */}
                    <div className='w-[144px] relative'>
                        <button
                            onClick={() => setIsDropdownOpen(prev => !prev)}
                            className='inline-flex items-center justify-between w-full px-3 py-2 rounded-md border border-gray-600 bg-gray-800 hover:border-gray-500 transition-colors text-gray-100'
                            aria-expanded={isDropdownOpen}
                            aria-haspopup='true'>
                            <span className='flex items-center gap-2'>
                                {isAdvancedView ? (
                                    <>
                                        <Settings
                                            size={16}
                                            className='text-gray-400'
                                        />
                                        <span className='text-sm font-medium'>
                                            Advanced
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <List
                                            size={16}
                                            className='text-gray-400'
                                        />
                                        <span className='text-sm font-medium'>
                                            Simple
                                        </span>
                                    </>
                                )}
                            </span>
                            <ChevronDown
                                size={16}
                                className={`text-gray-400 transition-transform ${
                                    isDropdownOpen ? 'transform rotate-180' : ''
                                }`}
                            />
                        </button>
                        {isDropdownOpen && (
                            <>
                                <div
                                    className='fixed inset-0'
                                    onClick={() => setIsDropdownOpen(false)}
                                />
                                <div className='absolute left-0 mt-1 w-full rounded-md shadow-lg bg-gray-800 border border-gray-600 z-10'>
                                    <div>
                                        <button
                                            onClick={() => {
                                                setIsDropdownOpen(false);
                                                // When switching from advanced to simple mode, convert to simple format
                                                if (
                                                    isAdvancedView &&
                                                    language
                                                ) {
                                                    if (language === 'any') {
                                                        // Keep 'any' as is
                                                    } else if (
                                                        language.includes('_')
                                                    ) {
                                                        // Extract the language part from format like "must_english"
                                                        const langPart =
                                                            language.split(
                                                                '_'
                                                            )[1];
                                                        // If no language part or if it's not a valid simple language, use 'any'
                                                        if (!langPart) {
                                                            onLanguageChange(
                                                                'any'
                                                            );
                                                        } else {
                                                            onLanguageChange(
                                                                langPart
                                                            );
                                                        }
                                                    }
                                                }
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm ${
                                                !isAdvancedView
                                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}>
                                            <div className='flex items-center gap-2'>
                                                <List size={16} />
                                                <span>Simple</span>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                // When switching from simple to advanced mode, convert basic language
                                                // to proper advanced format if necessary
                                                if (
                                                    !isAdvancedView &&
                                                    language &&
                                                    !language.includes('_')
                                                ) {
                                                    // Default to "must include original" if language is "any"
                                                    if (language === 'any') {
                                                        onLanguageChange(
                                                            'must_original'
                                                        );
                                                    } else {
                                                        // For other languages, use must_[language]
                                                        onLanguageChange(
                                                            `must_${language}`
                                                        );
                                                    }
                                                }
                                                setIsDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm ${
                                                isAdvancedView
                                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}>
                                            <div className='flex items-center gap-2'>
                                                <Settings size={16} />
                                                <span>Advanced</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* SIMPLE MODE: just one language dropdown */}
                    {!isAdvancedView && (
                        <div className='flex-1'>
                            <SearchDropdown
                                value={language}
                                onChange={e => onLanguageChange(e.target.value)}
                                options={languageOptions}
                                placeholder='Select language...'
                                dropdownWidth='100%'
                                className='bg-gray-800 dark:border-gray-600 text-gray-100'
                            />
                        </div>
                    )}

                    {/* ADVANCED MODE: two dropdowns (type and language) */}
                    {isAdvancedView && (
                        <>
                            {/* Type Dropdown - Custom styled */}
                            <div className='w-[144px] relative'>
                                <select
                                    value={currentBehavior}
                                    onChange={e =>
                                        handleAdvancedLanguageChange(
                                            'behavior',
                                            e.target.value
                                        )
                                    }
                                    className='w-full appearance-none rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 pr-8'>
                                    <option value='any'>Any</option>
                                    <option value='must'>Must Include</option>
                                    <option value='only'>Must Only Be</option>
                                    <option value='mustnot'>
                                        Must Not Include
                                    </option>
                                </select>
                                <div className='pointer-events-none absolute inset-y-0 right-0 flex items-center px-2'>
                                    <ChevronDown
                                        size={16}
                                        className='text-gray-400'
                                    />
                                </div>
                            </div>

                            {/* Language Dropdown */}
                            {currentBehavior !== 'any' && (
                                <div className='flex-1'>
                                    <SearchDropdown
                                        value={currentLanguage || 'english'}
                                        onChange={e =>
                                            handleAdvancedLanguageChange(
                                                'language',
                                                e.target.value
                                            )
                                        }
                                        options={[
                                            // Special items at the top
                                            {
                                                value: 'original',
                                                label: 'Original',
                                                description:
                                                    'Content must include Original, but can include other languages as well',
                                                isSpecial: true
                                            },
                                            // All other languages - sorted alphabetically
                                            ...LANGUAGES.filter(
                                                lang => lang.id !== 'original'
                                            ) // Skip original since we added it manually above
                                                .sort((a, b) =>
                                                    a.name.localeCompare(b.name)
                                                )
                                                .map(lang => ({
                                                    value: lang.id,
                                                    label: lang.name,
                                                    description: `Content must include ${lang.name}, but can include other languages as well`
                                                }))
                                        ]}
                                        placeholder='Select language...'
                                        dropdownWidth='100%'
                                        className='bg-gray-800 dark:border-gray-600 text-gray-100'
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Help text section - display the appropriate help text based on view mode and selection */}
                <div className='border border-gray-600 rounded-md p-4 bg-gray-800'>
                    {/* Simple mode help */}
                    {!isAdvancedView && (
                        <div className='flex items-center gap-1.5 text-xs text-gray-400'>
                            <InfoIcon className='h-3.5 w-3.5 text-blue-500 flex-shrink-0' />
                            <p>
                                {language === 'any' ? (
                                    <>
                                        Attempts to set{' '}
                                        <span className='font-medium text-gray-200'>
                                            Any Language
                                        </span>{' '}
                                        in Radarr profiles. For Sonarr, language
                                        will default to "Original" since it
                                        lacks native language settings.
                                    </>
                                ) : language === 'original' ? (
                                    <>
                                        Attempts to set{' '}
                                        <span className='font-medium text-gray-200'>
                                            Original
                                        </span>{' '}
                                        language in Radarr profiles. For Sonarr,
                                        language will default to "Original"
                                        since it lacks native language settings.
                                    </>
                                ) : (
                                    <>
                                        Attempts to set{' '}
                                        <span className='font-medium text-gray-200'>
                                            {LANGUAGES.find(
                                                l => l.id === language
                                            )?.name || language}
                                        </span>{' '}
                                        language in Radarr profiles. For Sonarr,
                                        language will default to "Original"
                                        since it lacks native language settings.
                                    </>
                                )}
                            </p>
                        </div>
                    )}

                    {/* Advanced mode help based on selections */}
                    {isAdvancedView && (
                        <>
                            {language === 'any' && (
                                <div className='flex items-center gap-1.5 text-xs text-gray-400'>
                                    <InfoIcon className='h-3.5 w-3.5 text-blue-500 flex-shrink-0' />
                                    <p>Accept content in any language.</p>
                                </div>
                            )}

                            {language && language.startsWith('must_') && (
                                <div className='flex items-center gap-1.5 text-xs text-gray-400'>
                                    <InfoIcon className='h-3.5 w-3.5 text-blue-500 flex-shrink-0' />
                                    <p>
                                        Content must include{' '}
                                        <span className='font-medium text-gray-200'>
                                            {language.split('_')[1]
                                                ? LANGUAGES.find(
                                                      l =>
                                                          l.id ===
                                                          language.split('_')[1]
                                                  )?.name ||
                                                  language.split('_')[1]
                                                : 'English'}
                                        </span>
                                        , but can include other languages as
                                        well.
                                    </p>
                                </div>
                            )}

                            {language && language.startsWith('only_') && (
                                <div className='flex items-center gap-1.5 text-xs'>
                                    <AlertTriangle className='h-3.5 w-3.5 text-amber-500 flex-shrink-0' />
                                    <p className='text-amber-400'>
                                        Content must ONLY be in{' '}
                                        <span className='font-medium text-amber-300'>
                                            {language.split('_')[1]
                                                ? LANGUAGES.find(
                                                      l =>
                                                          l.id ===
                                                          language.split('_')[1]
                                                  )?.name ||
                                                  language.split('_')[1]
                                                : 'English'}
                                        </span>
                                        . This will reject releases containing
                                        multiple languages.
                                    </p>
                                </div>
                            )}

                            {language && language.startsWith('mustnot_') && (
                                <div className='flex items-center gap-1.5 text-xs text-gray-400'>
                                    <InfoIcon className='h-3.5 w-3.5 text-blue-500 flex-shrink-0' />
                                    <p>
                                        Content must NOT include{' '}
                                        <span className='font-medium text-gray-200'>
                                            {language.split('_')[1]
                                                ? LANGUAGES.find(
                                                      l =>
                                                          l.id ===
                                                          language.split('_')[1]
                                                  )?.name ||
                                                  language.split('_')[1]
                                                : 'English'}
                                        </span>
                                        . Any other language is acceptable.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
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
