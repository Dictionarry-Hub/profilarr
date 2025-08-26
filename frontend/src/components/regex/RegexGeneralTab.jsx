import React, {useState} from 'react';
import PropTypes from 'prop-types';
import MarkdownEditor from '@ui/MarkdownEditor';
import AddButton from '@ui/DataBar/AddButton';
import {Regex, Loader} from 'lucide-react';
import {RegexPatterns} from '@api/data';
import Alert from '@ui/Alert';

const RegexGeneralTab = ({
    name,
    description,
    pattern,
    tags,
    onNameChange,
    onDescriptionChange,
    onPatternChange,
    onAddTag,
    onRemoveTag,
    error,
    patternError
}) => {
    const [newTag, setNewTag] = useState('');
    const [validating, setValidating] = useState(false);

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

    const handleValidatePattern = async () => {
        if (!pattern?.trim()) {
            Alert.warning('Please enter a pattern to validate');
            return;
        }

        setValidating(true);
        
        try {
            const result = await RegexPatterns.verify(pattern);
            
            if (result.valid) {
                Alert.success('Pattern is valid .NET regex');
            } else {
                Alert.error(result.error || 'Invalid pattern');
            }
        } catch (error) {
            console.error('Validation error:', error);
            Alert.error('Failed to validate pattern');
        } finally {
            setValidating(false);
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
            <div className='space-y-8'>
                {/* Name Input */}
                <div className='space-y-2'>
                    <div className='space-y-1'>
                        <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                            Pattern Name
                        </label>
                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                            Give your regex pattern a descriptive name
                        </p>
                    </div>
                    <input
                        type='text'
                        value={name}
                        onChange={e => onNameChange(e.target.value)}
                        placeholder='Enter pattern name'
                        className='w-full rounded-md border border-gray-300 dark:border-gray-600
                        bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm
                        text-gray-900 dark:text-gray-100
                        placeholder-gray-500 dark:placeholder-gray-400
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        transition-colors duration-200'
                    />
                </div>

                {/* Description */}
                <div className='space-y-2'>
                    <div className='space-y-1'>
                        <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                            Description
                        </label>
                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                            Describe what this pattern matches. Use markdown to
                            format your description.
                        </p>
                    </div>
                    <MarkdownEditor
                        value={description}
                        onChange={e => onDescriptionChange(e.target.value)}
                        placeholder='Describe what this pattern matches...'
                    />
                </div>

                {/* Pattern Input */}
                <div className='space-y-2'>
                    <div className='space-y-1'>
                        <div className='flex items-center justify-between'>
                            <div>
                                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                                    Pattern
                                </label>
                                <p className='text-xs text-gray-500 dark:text-gray-400'>
                                    Enter your regular expression pattern (case-insensitive .NET)
                                </p>
                            </div>
                            <button
                                onClick={handleValidatePattern}
                                disabled={validating || !pattern?.trim()}
                                className='inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md 
                                bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white
                                transition-colors duration-200'>
                                {validating ? (
                                    <Loader className='w-4 h-4 mr-2 animate-spin' />
                                ) : (
                                    <Regex className='w-4 h-4 mr-2' />
                                )}
                                Validate
                            </button>
                        </div>
                    </div>
                    {patternError && (
                        <p className='text-sm text-red-600 dark:text-red-400'>
                            {patternError}
                        </p>
                    )}
                    <textarea
                        value={pattern}
                        onChange={e => onPatternChange(e.target.value)}
                        className='w-full h-24 rounded-md border border-gray-300 dark:border-gray-600
                        bg-gray-50 dark:bg-gray-800 px-3 py-2
                        text-gray-900 dark:text-gray-100 font-mono text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        transition-colors duration-200'
                        placeholder='Enter your regex pattern here...'
                    />
                </div>

                {/* Tags */}
                <div className='space-y-4'>
                    <div className='space-y-1'>
                        <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                            Tags
                        </label>
                        <p className='text-xs text-gray-500 dark:text-gray-400'>
                            Add tags to organize and categorize this pattern
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
                            bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm
                            text-gray-900 dark:text-gray-100
                            placeholder-gray-500 dark:placeholder-gray-400
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            transition-colors duration-200'
                        />
                        <AddButton
                            onClick={handleAddTag}
                            disabled={!newTag.trim()}
                            label='Add'
                        />
                    </div>
                    {tags.length > 0 ? (
                        <div className='flex flex-wrap gap-2 rounded-md'>
                            {tags.map(tag => (
                                <span
                                    key={tag}
                                    className='inline-flex items-center px-2.5 py-1 rounded-md
                                    text-xs font-semibold
                                    bg-blue-600/20 text-blue-400
                                    group'>
                                    {tag}
                                    <button
                                        onClick={() => onRemoveTag(tag)}
                                        className='ml-1.5 p-0.5 rounded-md
                                        hover:bg-blue-500/20
                                        focus:outline-none focus:ring-2
                                        focus:ring-blue-500 focus:ring-offset-1
                                        transition-colors duration-200'>
                                        <svg
                                            className='w-3.5 h-3.5 text-blue-400
                                            opacity-60 group-hover:opacity-100 transition-opacity'
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
                        <div
                            className='flex items-center justify-center h-12 
                            text-sm text-gray-500 dark:text-gray-400 
                            rounded-md border border-dashed 
                            border-gray-300 dark:border-gray-700
                            bg-gray-50 dark:bg-gray-800/50'>
                            No tags added yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

RegexGeneralTab.propTypes = {
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    pattern: PropTypes.string.isRequired,
    tags: PropTypes.arrayOf(PropTypes.string).isRequired,
    onNameChange: PropTypes.func.isRequired,
    onDescriptionChange: PropTypes.func.isRequired,
    onPatternChange: PropTypes.func.isRequired,
    onAddTag: PropTypes.func.isRequired,
    onRemoveTag: PropTypes.func.isRequired,
    error: PropTypes.string,
    patternError: PropTypes.string
};

export default RegexGeneralTab;
