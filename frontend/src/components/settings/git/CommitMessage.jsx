import React, {useState, useEffect} from 'react';

const COMMIT_TYPES = [
    {value: 'feat', label: 'Feature', description: 'A new feature'},
    {value: 'fix', label: 'Bug Fix', description: 'A bug fix'},
    {
        value: 'docs',
        label: 'Documentation',
        description: 'Documentation only changes'
    },
    {
        value: 'style',
        label: 'Style',
        description: 'Changes that do not affect code meaning'
    },
    {
        value: 'refactor',
        label: 'Refactor',
        description: 'Code change that neither fixes a bug nor adds a feature'
    },
    {
        value: 'perf',
        label: 'Performance',
        description: 'A code change that improves performance'
    },
    {value: 'test', label: 'Test', description: 'Adding or correcting tests'},
    {
        value: 'chore',
        label: 'Chore',
        description: "Other changes that don't modify src or test files"
    },
    {value: 'custom', label: 'Custom', description: 'Custom type'}
];

const SCOPES = [
    {
        value: 'regex',
        label: 'Regex',
        description: 'Changes related to regex patterns'
    },
    {
        value: 'format',
        label: 'Format',
        description: 'Changes related to custom formats'
    },
    {
        value: 'profile',
        label: 'Profile',
        description: 'Changes related to quality profiles'
    },
    {value: 'custom', label: 'Custom', description: 'Custom scope'}
];

const formatBodyLines = text => {
    if (!text) return '';
    return text
        .split('\n')
        .map(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return '';
            const cleanLine = trimmedLine.startsWith('- ')
                ? trimmedLine.substring(2).trim()
                : trimmedLine;
            return cleanLine ? `- ${cleanLine}` : '';
        })
        .filter(Boolean)
        .join('\n');
};

const CommitSection = ({commitMessage, setCommitMessage}) => {
    const [type, setType] = useState('');
    const [customType, setCustomType] = useState('');
    const [scope, setScope] = useState('');
    const [customScope, setCustomScope] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [footer, setFooter] = useState('');

    useEffect(() => {
        const effectiveType = type === 'custom' ? customType : type;
        const effectiveScope = scope === 'custom' ? customScope : scope;

        if (effectiveType && subject) {
            let message = `${effectiveType}${
                effectiveScope ? `(${effectiveScope})` : ''
            }: ${subject}`;

            if (body) {
                message += `\n\n${formatBodyLines(body)}`;
            }

            if (footer) {
                message += `\n\n${footer}`;
            }

            setCommitMessage(message);
        } else {
            setCommitMessage('');
        }
    }, [
        type,
        customType,
        scope,
        customScope,
        subject,
        body,
        footer,
        setCommitMessage
    ]);

    const selectStyles =
        'bg-gray-700 text-sm text-gray-200 focus:outline-none focus:bg-gray-600 hover:bg-gray-600 transition-colors duration-150';
    const inputStyles = 'bg-gray-700 text-sm text-gray-200 focus:outline-none';

    return (
        <div className='mt-4'>
            <div className='bg-gray-800 rounded-md overflow-hidden border border-gray-700 shadow-sm'>
                <div className='flex items-center bg-gray-700 border-b border-gray-600'>
                    <div className='flex-none w-64 border-r border-gray-600'>
                        <div className='relative'>
                            <select
                                value={type}
                                onChange={e => setType(e.target.value)}
                                className={`w-full px-3 py-2.5 appearance-none cursor-pointer ${selectStyles}`}>
                                <option value='' disabled>
                                    Select Type
                                </option>
                                {COMMIT_TYPES.map(({value, label}) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                            <div className='absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none'>
                                <svg
                                    className='h-4 w-4 fill-current text-gray-400'
                                    xmlns='http://www.w3.org/2000/svg'
                                    viewBox='0 0 20 20'>
                                    <path d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' />
                                </svg>
                            </div>
                        </div>
                        {type === 'custom' && (
                            <input
                                type='text'
                                value={customType}
                                onChange={e => setCustomType(e.target.value)}
                                placeholder='Enter custom type'
                                className={`w-full px-3 py-2 border-t border-gray-600 bg-gray-800 ${inputStyles}`}
                            />
                        )}
                    </div>

                    <div className='flex-none w-64 border-r border-gray-600'>
                        <div className='relative'>
                            <select
                                value={scope}
                                onChange={e => setScope(e.target.value)}
                                className={`w-full px-3 py-2.5 appearance-none cursor-pointer ${selectStyles}`}>
                                <option value=''>No Scope</option>
                                {SCOPES.map(({value, label}) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                            <div className='absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none'>
                                <svg
                                    className='h-4 w-4 fill-current text-gray-400'
                                    xmlns='http://www.w3.org/2000/svg'
                                    viewBox='0 0 20 20'>
                                    <path d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' />
                                </svg>
                            </div>
                        </div>
                        {scope === 'custom' && (
                            <input
                                type='text'
                                value={customScope}
                                onChange={e => setCustomScope(e.target.value)}
                                placeholder='Enter custom scope'
                                className={`w-full px-3 py-2 border-t border-gray-600 bg-gray-800 ${inputStyles}`}
                            />
                        )}
                    </div>

                    <input
                        type='text'
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder='Brief description of the changes'
                        maxLength={50}
                        className={`flex-1 px-3 py-2.5 ${inputStyles}`}
                    />
                </div>

                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder='Detailed description of changes'
                    className={`w-full px-3 py-3 resize-none h-32 border-b border-gray-600 bg-gray-800 ${inputStyles}`}
                />

                <input
                    type='text'
                    value={footer}
                    onChange={e => setFooter(e.target.value)}
                    placeholder='References to issues, PRs (optional)'
                    className={`w-full px-3 py-2.5 bg-gray-800 ${inputStyles}`}
                />
            </div>
        </div>
    );
};

export default CommitSection;
