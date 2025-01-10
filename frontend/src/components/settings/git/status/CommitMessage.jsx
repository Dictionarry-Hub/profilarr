import React, {useState, useEffect} from 'react';
import {COMMIT_TYPES, COMMIT_SCOPES} from '@constants/commits';

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
    const [scope, setScope] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [footer, setFooter] = useState('');

    useEffect(() => {
        if (type && subject) {
            let message = `${type}${scope ? `(${scope})` : ''}: ${subject}`;

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
    }, [type, scope, subject, body, footer, setCommitMessage]);

    const selectStyles =
        'bg-gray-900 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
    const inputStyles =
        'bg-gray-900 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

    return (
        <div className='mt-4 space-y-4'>
            <div className='bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-xl'>
                <div className='p-4 space-y-4'>
                    <div className='flex space-x-4'>
                        <div className='flex-1'>
                            <label className='block text-sm font-medium text-gray-400 mb-1'>
                                Type
                            </label>
                            <div className='relative'>
                                <select
                                    value={type}
                                    onChange={e => setType(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-md appearance-none cursor-pointer ${selectStyles}`}>
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
                        </div>
                        <div className='flex-1'>
                            <label className='block text-sm font-medium text-gray-400 mb-1'>
                                Scope
                            </label>
                            <div className='relative'>
                                <select
                                    value={scope}
                                    onChange={e => setScope(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-md appearance-none cursor-pointer ${selectStyles}`}>
                                    <option value=''>No Scope</option>
                                    {COMMIT_SCOPES.map(({value, label}) => (
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
                        </div>
                    </div>

                    <div>
                        <label className='block text-sm font-medium text-gray-400 mb-1'>
                            Subject
                        </label>
                        <input
                            type='text'
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder='Brief description of the changes'
                            maxLength={50}
                            className={`w-full px-3 py-2 rounded-md ${inputStyles}`}
                        />
                    </div>

                    <div>
                        <label className='block text-sm font-medium text-gray-400 mb-1'>
                            Body
                        </label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder='Detailed description of changes'
                            className={`w-full px-3 py-2 rounded-md resize-none h-32 ${inputStyles}`}
                        />
                    </div>

                    <div>
                        <label className='block text-sm font-medium text-gray-400 mb-1'>
                            Footer
                        </label>
                        <input
                            type='text'
                            value={footer}
                            onChange={e => setFooter(e.target.value)}
                            placeholder='References to issues, PRs (optional)'
                            className={`w-full px-3 py-2 rounded-md ${inputStyles}`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommitSection;
