import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {InfoIcon} from 'lucide-react';

const LANGUAGES = [
    {id: 'any', name: 'Any', isSpecial: true},
    {id: 'original', name: 'Original', isSpecial: true},
    {id: 'arabic', name: 'Arabic'},
    {id: 'bengali', name: 'Bengali'},
    {id: 'bosnian', name: 'Bosnian'},
    {id: 'bulgarian', name: 'Bulgarian'},
    {id: 'catalan', name: 'Catalan'},
    {id: 'chinese', name: 'Chinese'},
    {id: 'croatian', name: 'Croatian'},
    {id: 'czech', name: 'Czech'},
    {id: 'danish', name: 'Danish'},
    {id: 'dutch', name: 'Dutch'},
    {id: 'english', name: 'English'},
    {id: 'estonian', name: 'Estonian'},
    {id: 'finnish', name: 'Finnish'},
    {id: 'flemish', name: 'Flemish'},
    {id: 'french', name: 'French'},
    {id: 'german', name: 'German'},
    {id: 'greek', name: 'Greek'},
    {id: 'hebrew', name: 'Hebrew'},
    {id: 'hindi', name: 'Hindi'},
    {id: 'hungarian', name: 'Hungarian'},
    {id: 'icelandic', name: 'Icelandic'},
    {id: 'indonesian', name: 'Indonesian'},
    {id: 'italian', name: 'Italian'},
    {id: 'japanese', name: 'Japanese'},
    {id: 'kannada', name: 'Kannada'},
    {id: 'korean', name: 'Korean'},
    {id: 'latvian', name: 'Latvian'},
    {id: 'lithuanian', name: 'Lithuanian'},
    {id: 'macedonian', name: 'Macedonian'},
    {id: 'malayalam', name: 'Malayalam'},
    {id: 'norwegian', name: 'Norwegian'},
    {id: 'persian', name: 'Persian'},
    {id: 'polish', name: 'Polish'},
    {id: 'portuguese', name: 'Portuguese'},
    {id: 'portuguese-brazil', name: 'Portuguese (Brazil)'},
    {id: 'romanian', name: 'Romanian'},
    {id: 'russian', name: 'Russian'},
    {id: 'serbian', name: 'Serbian'},
    {id: 'slovak', name: 'Slovak'},
    {id: 'slovenian', name: 'Slovenian'},
    {id: 'spanish', name: 'Spanish'},
    {id: 'spanish-latino', name: 'Spanish (Latino)'},
    {id: 'swedish', name: 'Swedish'},
    {id: 'tamil', name: 'Tamil'},
    {id: 'telugu', name: 'Telugu'},
    {id: 'thai', name: 'Thai'},
    {id: 'turkish', name: 'Turkish'},
    {id: 'ukrainian', name: 'Ukrainian'},
    {id: 'vietnamese', name: 'Vietnamese'}
];

const ProfileLanguagesTab = ({selectedLanguage, onLanguageChange}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className='h-full flex flex-col'>
            <div className='bg-white dark:bg-gray-800 pb-4'>
                <div className='grid grid-cols-[auto_1fr] gap-4 items-center'>
                    <h2 className='text-xl font-semibold text-gray-900 dark:text-gray-100 leading-tight'>
                        Language Preference
                    </h2>
                    <p className='text-xs text-gray-600 dark:text-gray-400 leading-relaxed'>
                        Select your preferred language for media content.
                    </p>
                </div>
            </div>

            <div className='mt-4 space-y-4'>
                <div className='flex gap-2 p-3 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg'>
                    <InfoIcon className='h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0' />
                    <p className='text-blue-700 dark:text-blue-300'>
                        Choose "Any" to accept all languages, or "Original" to
                        prefer the original language of the content. Selecting a
                        specific language will prioritize content in that
                        language when available.
                    </p>
                </div>

                <div className='relative'>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1'>
                        Preferred Language
                    </label>
                    <select
                        value={selectedLanguage}
                        onChange={e => onLanguageChange(e.target.value)}
                        className='scrollable mt-1 block w-64 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400'
                        style={{maxHeight: '200px', overflowY: 'auto'}}>
                        {LANGUAGES.map(language => (
                            <option
                                key={language.id}
                                value={language.id}
                                className={
                                    language.isSpecial
                                        ? 'font-semibold text-blue-600 dark:text-blue-400'
                                        : ''
                                }>
                                {language.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};

ProfileLanguagesTab.propTypes = {
    selectedLanguage: PropTypes.string.isRequired,
    onLanguageChange: PropTypes.func.isRequired
};

export default ProfileLanguagesTab;
