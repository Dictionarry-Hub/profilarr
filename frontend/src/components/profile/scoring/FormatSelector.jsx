import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import SearchDropdown from '@ui/SearchDropdown';

const FormatSelector = ({availableFormats, onFormatAdd}) => {
    const [selectedFormats, setSelectedFormats] = useState([]);
    const [dropdownOptions, setDropdownOptions] = useState([]);

    // Transform availableFormats into the format expected by SearchDropdown
    useEffect(() => {
        if (availableFormats && availableFormats.length > 0) {
            const options = availableFormats.map(format => ({
                value: format.id,
                label: format.name,
                description: format.tags ? format.tags.join(', ') : '',
                tags: format.tags
            }));
            setDropdownOptions(options);
        } else {
            setDropdownOptions([]);
        }
    }, [availableFormats]);

    const handleSelectFormat = e => {
        const formatId = e.target.value;
        if (formatId && !selectedFormats.includes(formatId)) {
            setSelectedFormats(prev => [...prev, formatId]);
            onFormatAdd(formatId);
        }
    };

    return (
        <div className='bg-gray-800 rounded-lg border border-gray-700 overflow-visible mb-4'>
            <div className='px-4 py-3 border-b border-gray-700'>
                <h3 className='text-sm font-bold text-gray-100 mb-2'>
                    Available Formats
                </h3>
                <p className='text-xs text-gray-400 mb-3'>
                    Select formats to include in your profile. Zero-scored
                    formats are still saved when selected.
                </p>

                <SearchDropdown
                    options={dropdownOptions}
                    value=''
                    onChange={handleSelectFormat}
                    placeholder='Select formats to add...'
                    searchableFields={['label', 'description']}
                    dropdownWidth='100%'
                    width='100%'
                />
            </div>

            {dropdownOptions.length === 0 && (
                <div className='py-4 text-sm text-gray-400 text-center italic'>
                    No available formats to add
                </div>
            )}
        </div>
    );
};

FormatSelector.propTypes = {
    availableFormats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            score: PropTypes.number.isRequired,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    onFormatAdd: PropTypes.func.isRequired
};

export default FormatSelector;
