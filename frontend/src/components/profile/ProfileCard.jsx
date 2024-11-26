import React from 'react';
import PropTypes from 'prop-types';
import {Copy, Globe2, Settings2, ArrowUpCircle} from 'lucide-react';

function unsanitize(text) {
    if (!text) return '';
    return text.replace(/\\:/g, ':').replace(/\\n/g, '\n');
}

const ProfileCard = ({profile, onEdit, onClone, sortBy, formatDate}) => {
    console.log('sortBy:', sortBy); // Add this line
    console.log('profile dates:', profile.modified_date, profile.created_date);
    if (!profile || !profile.content) return null;

    const {content} = profile;
    const activeCustomFormats = (content.custom_formats || []).filter(
        format => format.score !== 0
    ).length;

    return (
        <div
            className='w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer'
            onClick={() => onEdit(profile)}>
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
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                onClone(profile);
                            }}
                            className='p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors shrink-0'>
                            <Copy className='w-5 h-5 text-gray-500 dark:text-gray-400' />
                        </button>
                    </div>
                </div>

                {/* Content Columns */}
                <div className='flex gap-6'>
                    {/* Left Column: Main Content */}
                    <div className='flex-1'>
                        {/* Description */}
                        {content.description && (
                            <p className='text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-4'>
                                {unsanitize(content.description)}
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

                    {/* Right Column: Qualities */}
                    <div className='w-2/5 border-l border-gray-200 dark:border-gray-700 pl-6 flex flex-col gap-4'>
                        {content.qualities &&
                            content.qualities.map(quality =>
                                quality.qualities ? (
                                    // Group quality - check if group name matches
                                    <div
                                        key={quality.name}
                                        className={`${
                                            quality.name ===
                                                content.upgrade_until?.name ||
                                            quality.qualities.some(
                                                q =>
                                                    q.name ===
                                                    content.upgrade_until?.name
                                            )
                                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                                : 'bg-gray-50 dark:bg-gray-700/50'
                                        } rounded-lg p-3`}>
                                        <div className='text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
                                            {quality.name}
                                        </div>
                                        <div className='flex flex-wrap gap-1.5'>
                                            {quality.qualities.map(
                                                subQuality => (
                                                    <span
                                                        key={subQuality.id}
                                                        className={`bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded text-xs inline-flex items-center ${
                                                            subQuality.name ===
                                                            content
                                                                .upgrade_until
                                                                ?.name
                                                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                                                : 'bg-gray-50 dark:bg-gray-700/50'
                                                        }`}>
                                                        {subQuality.name}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    // Individual quality - keep the same
                                    <div
                                        key={quality.id}
                                        className={`${
                                            quality.name ===
                                            content.upgrade_until?.name
                                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                                : 'bg-gray-50 dark:bg-gray-700/50'
                                        } rounded-lg p-3`}>
                                        <div className='text-sm font-medium text-gray-700 dark:text-gray-200'>
                                            {quality.name}
                                        </div>
                                    </div>
                                )
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
            upgrade_until: PropTypes.shape({
                id: PropTypes.number.isRequired,
                name: PropTypes.string.isRequired
            }),
            qualities: PropTypes.arrayOf(
                PropTypes.oneOfType([
                    // Quality group
                    PropTypes.shape({
                        name: PropTypes.string.isRequired,
                        qualities: PropTypes.arrayOf(
                            PropTypes.shape({
                                id: PropTypes.number.isRequired,
                                name: PropTypes.string.isRequired
                            })
                        )
                    }),
                    // Individual quality
                    PropTypes.shape({
                        id: PropTypes.number.isRequired,
                        name: PropTypes.string.isRequired
                    })
                ])
            ),
            custom_formats: PropTypes.arrayOf(
                PropTypes.shape({
                    name: PropTypes.string,
                    score: PropTypes.number
                })
            ),
            language: PropTypes.string
        }).isRequired
    }).isRequired,
    onEdit: PropTypes.func.isRequired,
    onClone: PropTypes.func.isRequired,
    sortBy: PropTypes.string.isRequired,
    formatDate: PropTypes.func.isRequired
};

export default ProfileCard;
