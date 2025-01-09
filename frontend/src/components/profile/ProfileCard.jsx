import React from 'react';
import PropTypes from 'prop-types';
import {Copy, Globe2, Settings2, ArrowUpCircle, Check} from 'lucide-react';
import Tooltip from '@ui/Tooltip';

function unsanitize(text) {
    if (!text) return '';
    return text.replace(/\\:/g, ':').replace(/\\n/g, '\n');
}

const MAX_DESCRIPTION_LENGTH = 1000;

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
        // Prevent text selection when shift-clicking
        if (e.shiftKey) {
            e.preventDefault();
        }
    };

    const truncateDescription = text => {
        if (!text) return '';
        if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
        return text.substring(0, MAX_DESCRIPTION_LENGTH) + '...';
    };

    return (
        <div
            className={`w-full h-full bg-white dark:bg-gray-800 border ${
                isSelected
                    ? 'border-blue-500 dark:border-blue-400'
                    : willBeSelected
                    ? 'border-blue-300 dark:border-blue-600'
                    : 'border-gray-200 dark:border-gray-700'
            } rounded-lg shadow hover:shadow-lg ${
                isSelectionMode
                    ? isSelected
                        ? 'hover:border-blue-400'
                        : 'hover:border-gray-400'
                    : 'hover:border-blue-400'
            } dark:hover:border-blue-500 transition-all cursor-pointer`}
            onClick={handleClick}
            onMouseDown={handleMouseDown}>
            <div className='flex flex-col p-6 gap-3'>
                {/* Header Section */}
                <div className='flex justify-between items-center gap-4'>
                    <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100 truncate'>
                        {unsanitize(content.name)}
                    </h3>
                    <div className='flex items-center gap-3'>
                        {(sortBy === 'dateModified' ||
                            sortBy === 'dateCreated') && (
                            <span className='text-xs text-gray-500 dark:text-gray-400 shrink-0'>
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
                                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        isSelected
                                            ? 'bg-blue-500'
                                            : willBeSelected
                                            ? 'bg-blue-200 dark:bg-blue-800'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                    } transition-colors hover:bg-blue-600`}>
                                    {isSelected && (
                                        <Check
                                            size={16}
                                            className='text-white'
                                        />
                                    )}
                                    {willBeSelected && !isSelected && (
                                        <div className='w-2 h-2 rounded-full bg-blue-400' />
                                    )}
                                </div>
                            </Tooltip>
                        ) : (
                            <button
                                onClick={handleCloneClick}
                                className='p-2 rounded-full transition-colors shrink-0 hover:bg-gray-100 dark:hover:bg-gray-700'>
                                <Copy className='w-5 h-5 text-gray-500 dark:text-gray-400' />
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className='flex-1'>
                    {/* Description */}
                    {content.description && (
                        <p className='text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-4'>
                            {truncateDescription(
                                unsanitize(content.description)
                            )}
                        </p>
                    )}

                    {/* Metadata Row */}
                    <div className='flex flex-wrap items-center gap-4 text-sm'>
                        <div className='flex items-center gap-2'>
                            <Settings2 className='w-4 h-4 text-gray-400 dark:text-gray-500' />
                            <span className='text-gray-600 dark:text-gray-300'>
                                {activeCustomFormats} format
                                {activeCustomFormats !== 1 ? 's' : ''}
                            </span>
                        </div>

                        <div className='flex items-center gap-2'>
                            <Globe2 className='w-4 h-4 text-gray-400 dark:text-gray-500' />
                            <span className='text-gray-600 dark:text-gray-300 capitalize'>
                                {content.language || 'any'}
                            </span>
                        </div>

                        {content.upgradesAllowed && (
                            <span className='inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs border border-blue-200 dark:border-blue-800'>
                                <ArrowUpCircle className='w-3.5 h-3.5' />
                                Upgrades allowed
                            </span>
                        )}

                        {content.tags && content.tags.length > 0 && (
                            <div className='flex flex-wrap gap-2'>
                                {content.tags.map(tag => (
                                    <span
                                        key={`${profile.file_name}-${tag}`}
                                        className='bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded text-sm'>
                                        {unsanitize(tag)}
                                    </span>
                                ))}
                            </div>
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
            upgradesAllowed: PropTypes.bool
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
