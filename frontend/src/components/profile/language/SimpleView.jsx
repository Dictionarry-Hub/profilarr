import React, {useMemo} from 'react';
import PropTypes from 'prop-types';
import {LANGUAGES} from '@constants/languages';
import SearchDropdown from '@ui/SearchDropdown';

const SimpleView = ({language, onLanguageChange}) => {
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
                description: 'Content must include Original, but can include other languages as well',
                isSpecial: true
            },
            // All other languages - sorted alphabetically
            ...LANGUAGES
                .filter(lang => lang.id !== 'original') // Skip original since we added it manually above
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(lang => ({
                    value: lang.id,
                    label: lang.name,
                    description: `Content must include ${lang.name}, but can include other languages as well`
                }))
        ];
    }, []);

    return (
        <SearchDropdown
            value={language}
            onChange={e => onLanguageChange(e.target.value)}
            options={languageOptions}
            placeholder="Select language..."
            dropdownWidth="100%"
        />
    );
};

SimpleView.propTypes = {
    language: PropTypes.string.isRequired,
    onLanguageChange: PropTypes.func.isRequired
};

export default SimpleView;
