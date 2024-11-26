import React, {useState} from 'react';
import PropTypes from 'prop-types';
import Textarea from '../ui/TextArea';

const ProfileGeneralTab = ({
    name,
    description,
    tags,
    upgradesAllowed,
    onNameChange,
    onDescriptionChange,
    onUpgradesAllowedChange,
    onAddTag,
    onRemoveTag,
    error
}) => {
    const [newTag, setNewTag] = useState('');

    const handleAddTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            onAddTag(newTag.trim());
            setNewTag('');
        }
    };

    const handleKeyPress = e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    return (
        <div className='w-full'>
            {error && (
                <div className='bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6'>
                    <p className='text-sm text-red-600 dark:text-red-400'>
                        {error}
                    </p>
                </div>
            )}
            <div className='space-y-6'>
                <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                        <div className='space-y-1'>
                            <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                                Profile Name
                            </label>
                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                                Name of this profile. Import will use the same
                                name
                            </p>
                        </div>
                        <div className='flex flex-col items-end space-y-1'>
                            <label className='flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer'>
                                <input
                                    type='checkbox'
                                    checked={upgradesAllowed}
                                    onChange={e =>
                                        onUpgradesAllowedChange(
                                            e.target.checked
                                        )
                                    }
                                    className='rounded border-gray-300 dark:border-gray-600 
                                    text-blue-500 focus:ring-blue-500 
                                    h-4 w-4 cursor-pointer
                                    transition-colors duration-200'
                                />
                                <span>Upgrades Allowed</span>
                            </label>
                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                                Allow automatic upgrades for this profile
                            </p>
                        </div>
                    </div>
                    <input
                        type='text'
                        value={name}
                        onChange={e => onNameChange(e.target.value)}
                        placeholder='Enter profile name'
                        className='w-full rounded-md border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-700 px-3 py-2 text-sm
                        text-gray-900 dark:text-gray-100
                        placeholder-gray-500 dark:placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        transition-colors duration-200'
                    />
                </div>

                <div className='space-y-2'>
                    <div className='space-y-1'>
                        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                            Description
                        </label>
                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                            Add any notes or details about this profile's
                            purpose and configuration
                        </p>
                    </div>
                    <Textarea
                        value={description}
                        onChange={e => onDescriptionChange(e.target.value)}
                        placeholder='Enter a description for this profile'
                        rows={4}
                        className='w-full rounded-md border border-gray-300 dark:border-gray-600
                        bg-white dark:bg-gray-700
                        text-gray-900 dark:text-gray-100
                        placeholder-gray-500 dark:placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        transition-colors duration-200'
                    />
                </div>

                <div className='space-y-4'>
                    <div className='space-y-1'>
                        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                            Tags
                        </label>
                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                            Add tags to organize and categorize this profile
                        </p>
                    </div>
                    <div className='flex space-x-2'>
                        <input
                            type='text'
                            value={newTag}
                            onChange={e => setNewTag(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder='Add a tag'
                            className='w-full rounded-md border border-gray-300 dark:border-gray-600
                            bg-white dark:bg-gray-700 px-3 py-2 text-sm
                            text-gray-900 dark:text-gray-100
                            placeholder-gray-500 dark:placeholder-gray-400
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            transition-colors duration-200'
                        />
                        <button
                            onClick={handleAddTag}
                            disabled={!newTag.trim()}
                            className='px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white rounded-md text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800'>
                            Add
                        </button>
                    </div>
                    {tags.length > 0 ? (
                        <div className='flex flex-wrap gap-2 rounded-md '>
                            {tags.map(tag => (
                                <span
                                    key={tag}
                                    className='inline-flex items-center p-1.5 rounded-md text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 group'>
                                    {tag}
                                    <button
                                        onClick={() => onRemoveTag(tag)}
                                        className='ml-1.5 hover:text-blue-900 dark:hover:text-blue-200 focus:outline-none'>
                                        <svg
                                            className='w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity'
                                            fill='none'
                                            stroke='currentColor'
                                            viewBox='0 0 24 24'>
                                            <path
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                                strokeWidth='2'
                                                d='M6 18L18 6M6 6l12 12'
                                            />
                                        </svg>
                                    </button>
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className='flex items-center justify-center h-[2.5rem] text-sm text-gray-500 dark:text-gray-400 rounded-md border border-dashed border-dark-border'>
                            No tags added yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

ProfileGeneralTab.propTypes = {
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    tags: PropTypes.arrayOf(PropTypes.string).isRequired,
    upgradesAllowed: PropTypes.bool.isRequired,
    onNameChange: PropTypes.func.isRequired,
    onDescriptionChange: PropTypes.func.isRequired,
    onUpgradesAllowedChange: PropTypes.func.isRequired,
    onAddTag: PropTypes.func.isRequired,
    onRemoveTag: PropTypes.func.isRequired,
    error: PropTypes.string
};

export default ProfileGeneralTab;
