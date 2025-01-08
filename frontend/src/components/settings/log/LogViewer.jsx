import React from 'react';
import {ANSI_COLORS} from '@constants/colors';

const parseAnsiLine = line => {
    // Split on ANSI escape sequences
    const parts = line.split(/\u001b\[(\d+)m/g);
    if (parts.length === 1) return [{text: line, className: 'text-gray-200'}];

    const result = [];
    let currentClasses = ['text-gray-200'];

    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            // Text content
            if (parts[i]) {
                result.push({
                    text: parts[i],
                    className: currentClasses.join(' ')
                });
            }
        } else {
            // ANSI code
            if (parts[i] === '0') {
                currentClasses = ['text-gray-200'];
            } else {
                const colorClass = ANSI_COLORS[parts[i]];
                if (colorClass) {
                    if (parts[i] === '1' || parts[i] === '22') {
                        currentClasses = currentClasses
                            .filter(c => !c.startsWith('font-'))
                            .concat([colorClass]);
                    } else {
                        currentClasses = currentClasses
                            .filter(c => !c.startsWith('text-'))
                            .concat([colorClass]);
                    }
                }
            }
        }
    }

    return result;
};

const LogViewer = ({
    selectedFile,
    zoom,
    setZoom,
    loading,
    error,
    logContent
}) => {
    return (
        <div className='h-full bg-gray-800 rounded-lg border border-gray-700 shadow-xl'>
            <div className='px-4 py-2 border-b border-gray-700 flex items-center justify-between'>
                <div className='text-gray-200 text-sm pl-2'>{selectedFile}</div>
                <div className='flex items-center gap-2'>
                    <span className='text-gray-400 text-sm'>Zoom:</span>
                    <button
                        onClick={() =>
                            setZoom(prev => Math.max(0.5, prev - 0.1))
                        }
                        className='text-gray-400 hover:text-white px-2 py-1 rounded'>
                        -
                    </button>
                    <span className='text-gray-300 text-sm w-12 text-center'>
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
                        className='text-gray-400 hover:text-white px-2 py-1 rounded'>
                        +
                    </button>
                </div>
            </div>
            <div
                className='h-[calc(100vh-28rem)] overflow-y-auto p-4 scrollable'
                style={{fontSize: `${zoom}rem`}}>
                {loading && (
                    <div className='flex items-center justify-center p-4 text-gray-400'>
                        <span>Loading logs...</span>
                    </div>
                )}
                {!loading && error && (
                    <div className='flex items-center justify-center p-4 text-red-400'>
                        {error}
                    </div>
                )}
                {!loading &&
                    !error &&
                    logContent.length === 0 &&
                    selectedFile && (
                        <div className='flex items-center justify-center p-4 text-gray-400'>
                            No log content found
                        </div>
                    )}
                {!loading && !error && (
                    <div>
                        {logContent.map((line, lineIdx) => (
                            <pre
                                key={lineIdx}
                                className='py-1 px-2 hover:bg-gray-700 rounded transition-colors whitespace-pre-wrap break-all font-mono'>
                                {parseAnsiLine(line).map((part, partIdx) => (
                                    <span
                                        key={partIdx}
                                        className={part.className}>
                                        {part.text}
                                    </span>
                                ))}
                            </pre>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LogViewer;
