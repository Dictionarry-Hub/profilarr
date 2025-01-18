import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Code,
    Link,
    Quote,
    Eye,
    Edit2
} from 'lucide-react';
import Textarea from '../ui/TextArea';
import ReactMarkdown from 'react-markdown';

const MarkdownEditor = ({value, onChange, placeholder}) => {
    const [isPreview, setIsPreview] = useState(false);

    const insertMarkdown = (prefix, suffix = '') => {
        const textarea = document.querySelector('#markdown-textarea');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);

        const beforeText = value.substring(0, start);
        const afterText = value.substring(end);

        const newText = selectedText
            ? `${beforeText}${prefix}${selectedText}${suffix}${afterText}`
            : `${beforeText}${prefix}placeholder${suffix}${afterText}`;

        onChange({target: {value: newText}});

        setTimeout(() => {
            textarea.focus();
            const newPosition = selectedText
                ? start + prefix.length + selectedText.length + suffix.length
                : start + prefix.length + 'placeholder'.length;
            textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
    };

    const controls = [
        {
            icon: Bold,
            label: 'Bold',
            action: () => insertMarkdown('**', '**')
        },
        {
            icon: Italic,
            label: 'Italic',
            action: () => insertMarkdown('*', '*')
        },
        {
            icon: Code,
            label: 'Code',
            action: () => insertMarkdown('`', '`')
        },
        {
            icon: Link,
            label: 'Link',
            action: () => insertMarkdown('[', '](url)')
        },
        {
            icon: ListOrdered,
            label: 'Numbered List',
            action: () => insertMarkdown('\n1. ')
        },
        {
            icon: List,
            label: 'Bullet List',
            action: () => insertMarkdown('\n- ')
        },
        {
            icon: Quote,
            label: 'Quote',
            action: () => insertMarkdown('\n> ')
        }
    ];

    return (
        <div className='rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 overflow-hidden'>
            {/* Markdown Controls */}
            <div className='flex items-center gap-1 p-2 border-b border-gray-300 dark:border-gray-600'>
                {isPreview ? (
                    <div className='flex items-center gap-2 text-gray-700 dark:text-gray-300 ml-2'>
                        <Eye className='w-4 h-4' />
                        <span className='text-sm font-medium'>Preview</span>
                    </div>
                ) : (
                    controls.map(control => (
                        <button
                            key={control.label}
                            onClick={control.action}
                            className='p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors'
                            title={control.label}>
                            <control.icon className='w-4 h-4' />
                        </button>
                    ))
                )}

                {/* Preview Toggle */}
                <div className='ml-auto'>
                    <button
                        onClick={() => setIsPreview(!isPreview)}
                        className='flex items-center gap-2 px-3 py-2 rounded-md
        bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 
        hover:bg-gray-50 dark:hover:bg-gray-750
        hover:border-blue-500/50 hover:text-blue-500
        dark:hover:border-blue-500/50 dark:hover:text-blue-400
        transition-all duration-150 ease-in-out
        group'
                        title={
                            isPreview
                                ? 'Switch to Edit Mode'
                                : 'Switch to Preview Mode'
                        }>
                        {isPreview ? (
                            <Edit2
                                className='w-4 h-4 transition-transform duration-300 ease-out
                group-hover:rotate-12 group-hover:scale-110 
                group-hover:text-blue-500 dark:group-hover:text-blue-400'
                            />
                        ) : (
                            <Eye
                                className='w-4 h-4 transition-transform duration-300 ease-out
                group-hover:animate-eye-blink 
                group-hover:text-blue-500 dark:group-hover:text-blue-400'
                            />
                        )}
                        <span className='text-sm font-medium'>
                            {isPreview ? 'Edit' : 'Preview'}
                        </span>
                    </button>
                </div>
            </div>

            {/* Editor/Preview Area */}
            <div>
                {isPreview ? (
                    <div className='px-4 py-3 min-h-[300px] h-full prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-gray-700'>
                        {value ? (
                            <ReactMarkdown>{value}</ReactMarkdown>
                        ) : (
                            <p className='text-gray-500 dark:text-gray-400 italic'>
                                Nothing to preview
                            </p>
                        )}
                    </div>
                ) : (
                    <Textarea
                        id='markdown-textarea'
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        rows={12}
                    />
                )}
            </div>
        </div>
    );
};

MarkdownEditor.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string
};

export default MarkdownEditor;
