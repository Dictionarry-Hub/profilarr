import React from 'react';
import PropTypes from 'prop-types';
import {
    Copy,
    Globe2,
    Settings2,
    ArrowUpCircle,
    Check,
    ChevronRight
} from 'lucide-react';
import Tooltip from '@ui/Tooltip';
import ReactMarkdown from 'react-markdown';

function unsanitize(text) {
    if (!text) return '';
    return text.replace(/\\:/g, ':').replace(/\\n/g, '\n');
}

function parseLanguage(languageStr) {
    if (!languageStr || languageStr === 'any') return 'Any';

    const [type, language] = languageStr.split('_');
    const capitalizedLanguage =
        language.charAt(0).toUpperCase() + language.slice(1);

    switch (type) {
        case 'only':
            return `Must Only Be: ${capitalizedLanguage}`;
        case 'must':
            return `Must Include: ${capitalizedLanguage}`;
        default:
            return capitalizedLanguage;
    }
}

const ProfileCard = ({
    profile,
    onEdit,
    onClone,
    sortBy,
    formatDate,
    isSelectionMode,
    isSelected,
    willBeSelected,
    onSelect
}) => {
    if (!profile || !profile.content) return null;

    const {content} = profile;
    const activeCustomFormats = (content.custom_formats || []).filter(
        format => format.score !== 0
    ).length;

    const handleClick = e => {
        if (isSelectionMode) {
            onSelect(e);
        } else {
            onEdit(profile);
        }
    };

    const handleCloneClick = e => {
        e.stopPropagation();
        if (!isSelectionMode) {
            onClone(profile);
        }
    };

    const handleMouseDown = e => {
        if (e.shiftKey) {
            e.preventDefault();
        }
    };

    // Get quality preferences as an array
    const qualityPreferences = content.qualities?.map(q => q.name) || [];

    return (
        <div
            className={`w-full h-[24rem] bg-gradient-to-br from-gray-800/95 to-gray-900 border ${
                isSelected
                    ? 'border-blue-500'
                    : willBeSelected
                    ? 'border-blue-300'
                    : 'border-gray-700'
            } rounded-lg shadow-lg hover:shadow-xl ${
                isSelectionMode
                    ? isSelected
                        ? 'hover:border-blue-400'
                        : 'hover:border-gray-400'
                    : 'hover:border-blue-400'
            } transition-all cursor-pointer overflow-hidden flex flex-col`}
            onClick={handleClick}
            onMouseDown={handleMouseDown}>
            <div className='p-6 flex flex-col h-full'>
                {/* Header Section - Fixed Height */}
                <div className='flex-none'>
                    <div className='flex justify-between items-start'>
                        <div className='flex items-center gap-3 flex-wrap'>
                            <h3 className='text-lg font-bold text-gray-100'>
                                {unsanitize(content.name)}
                            </h3>
                            {content.tags && content.tags.length > 0 && (
                                <div className='flex flex-wrap gap-2'>
                                    {content.tags.map(tag => (
                                        <span
                                            key={`${profile.file_name}-${tag}`}
                                            className='bg-blue-600/20 text-blue-400 px-2 py-1 rounded-md text-xs font-semibold shadow-sm'>
                                            {unsanitize(tag)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className='flex items-center'>
                            <div className='w-8 h-8 flex items-center justify-center'>
                                {isSelectionMode ? (
                                    <Tooltip
                                        content={
                                            isSelected
                                                ? 'Selected'
                                                : willBeSelected
                                                ? 'Will be selected'
                                                : 'Select'
                                        }>
                                        <div
                                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                                isSelected
                                                    ? 'bg-blue-500'
                                                    : willBeSelected
                                                    ? 'bg-blue-200/20'
                                                    : 'bg-gray-200/20'
                                            } transition-colors hover:bg-blue-600`}>
                                            {isSelected && (
                                                <Check
                                                    size={14}
                                                    className='text-white'
                                                />
                                            )}
                                            {willBeSelected && !isSelected && (
                                                <div className='w-1.5 h-1.5 rounded-full bg-blue-400' />
                                            )}
                                        </div>
                                    </Tooltip>
                                ) : (
                                    <button
                                        onClick={handleCloneClick}
                                        className='text-gray-400 hover:text-white transition-colors'>
                                        <Copy className='w-5 h-5' />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quality Preferences */}
                    {qualityPreferences.length > 0 && (
                        <div className='mt-6 flex items-center space-x-2 text-sm text-gray-300 overflow-x-auto pb-2'>
                            {qualityPreferences.map((pref, index) => (
                                <React.Fragment key={index}>
                                    <span className='whitespace-nowrap'>
                                        {pref}
                                    </span>
                                    {index < qualityPreferences.length - 1 && (
                                        <ChevronRight className='w-4 h-4 text-blue-400 flex-shrink-0' />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>

                <hr className='border-gray-700 my-3' />

                {/* Description - Fixed Height with Scroll */}
                <div className='flex-1 overflow-hidden text-sm'>
                    {content.description && (
                        <div
                            className='h-full overflow-y-auto prose prose-invert prose-gray max-w-none
    [&>ul]:list-disc [&>ul]:ml-4 [&>ul]:mt-2 [&>ul]:mb-4
    [&>ol]:list-decimal [&>ol]:ml-4 [&>ol]:mt-2 [&>ol]:mb-4
    [&>ul>li]:mt-0.5 [&>ol>li]:mt-0.5'>
                            <ReactMarkdown>
                                {unsanitize(content.description)}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Footer Section - Fixed Height */}
                <div className='flex-none'>
                    <hr className='border-gray-700 my-6' />

                    {/* Metadata Row */}
                    <div className='flex flex-wrap items-center justify-between text-sm text-gray-300'>
                        <div className='flex items-center gap-4'>
                            <div className='flex items-center gap-2'>
                                <Settings2 className='w-4 h-4 text-blue-400' />
                                <span>
                                    {activeCustomFormats} format
                                    {activeCustomFormats !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className='flex items-center gap-2'>
                                <Globe2 className='w-4 h-4 text-blue-400' />
                                <span>{parseLanguage(content.language)}</span>
                            </div>

                            {content.upgradesAllowed && (
                                <div className='flex items-center gap-2'>
                                    <ArrowUpCircle className='w-4 h-4 text-blue-400' />
                                    <span>Upgrades Allowed</span>
                                </div>
                            )}
                        </div>

                        {(sortBy === 'dateModified' ||
                            sortBy === 'dateCreated') && (
                            <span className='text-xs text-gray-400 shrink-0'>
                                {sortBy === 'dateModified'
                                    ? 'Modified'
                                    : 'Created'}
                                :{' '}
                                {formatDate(
                                    sortBy === 'dateModified'
                                        ? profile.modified_date
                                        : profile.created_date
                                )}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

ProfileCard.propTypes = {
    profile: PropTypes.shape({
        file_name: PropTypes.string,
        modified_date: PropTypes.string,
        created_date: PropTypes.string,
        content: PropTypes.shape({
            name: PropTypes.string.isRequired,
            description: PropTypes.string,
            tags: PropTypes.arrayOf(PropTypes.string),
            custom_formats: PropTypes.arrayOf(
                PropTypes.shape({
                    name: PropTypes.string,
                    score: PropTypes.number
                })
            ),
            language: PropTypes.string,
            upgradesAllowed: PropTypes.bool,
            qualities: PropTypes.arrayOf(
                PropTypes.shape({
                    id: PropTypes.number,
                    name: PropTypes.string
                })
            )
        }).isRequired
    }).isRequired,
    onEdit: PropTypes.func.isRequired,
    onClone: PropTypes.func.isRequired,
    sortBy: PropTypes.string.isRequired,
    formatDate: PropTypes.func.isRequired,
    isSelectionMode: PropTypes.bool.isRequired,
    isSelected: PropTypes.bool.isRequired,
    willBeSelected: PropTypes.bool,
    onSelect: PropTypes.func.isRequired
};

export default ProfileCard;
