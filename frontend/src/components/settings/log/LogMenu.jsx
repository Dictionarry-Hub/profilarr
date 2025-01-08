// LogMenu.jsx
import React from 'react';
import {Search} from 'lucide-react';

const LogMenu = ({
    logTypes,
    selectedType,
    setSelectedType,
    selectedFile,
    setSelectedFile,
    filteredFiles,
    filters,
    handleChange
}) => {
    const selectStyles =
        'bg-gray-900 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

    const formatLogType = type => {
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    return (
        <div className='bg-gray-800 rounded-lg border border-gray-700 shadow-xl p-4'>
            <div className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                    {/* Log Type Selection */}
                    <div className='relative'>
                        <select
                            className={`w-full px-3 py-1.5 rounded-md appearance-none cursor-pointer ${selectStyles}`}
                            value={selectedType}
                            onChange={e => setSelectedType(e.target.value)}>
                            {logTypes.map(type => (
                                <option key={type} value={type}>
                                    Type: {formatLogType(type)}
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

                    <div className='relative'>
                        <select
                            className={`w-full px-3 py-1.5 rounded-md appearance-none cursor-pointer ${selectStyles}`}
                            value={selectedFile}
                            onChange={e => setSelectedFile(e.target.value)}>
                            {filteredFiles.map(f => (
                                <option key={f.filename} value={f.filename}>
                                    File: {f.filename}
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

                    <input
                        type='number'
                        className={`w-full px-3 py-1.5 rounded-md ${selectStyles}`}
                        value={filters.lines}
                        onChange={e => handleChange('lines', e.target.value)}
                        placeholder='Lines: last N lines...'
                    />

                    <div className='relative'>
                        <select
                            className={`w-full px-3 py-1.5 rounded-md appearance-none cursor-pointer ${selectStyles}`}
                            value={filters.level}
                            onChange={e =>
                                handleChange('level', e.target.value)
                            }>
                            <option value=''>Level: All</option>
                            <option value='info'>Level: INFO</option>
                            <option value='debug'>Level: DEBUG</option>
                            <option value='warning'>Level: WARNING</option>
                            <option value='error'>Level: ERROR</option>
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

                <div className='relative'>
                    <div className='absolute inset-y-0 left-3 flex items-center pointer-events-none'>
                        <Search size={16} className='text-gray-400' />
                    </div>
                    <input
                        className={`w-full pl-10 pr-3 py-1.5 rounded-md ${selectStyles}`}
                        placeholder='Search logs...'
                        value={filters.search}
                        onChange={e => handleChange('search', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
};

export default LogMenu;
