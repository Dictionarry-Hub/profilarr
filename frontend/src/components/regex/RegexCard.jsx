import React, {useState, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import {Copy, Check, FlaskConical} from 'lucide-react';
import Tooltip from '@ui/Tooltip';
import ReactMarkdown from 'react-markdown';

const RegexCard = ({
    pattern,
    onEdit,
    onClone,
    formatDate,
    sortBy,
    isSelectionMode,
    isSelected,
    willBeSelected,
    onSelect
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const cardRef = useRef(null);
    
    const totalTests = pattern.tests?.length || 0;
    const passedTests = pattern.tests?.filter(t => t.passes)?.length || 0;
    const passRate =
        totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    const handleClick = e => {
        if (isSelectionMode) {
            onSelect(e);
        } else {
            onEdit();
        }
    };

    const handleCloneClick = e => {
        e.stopPropagation();
        onClone(pattern);
    };

    const handleMouseDown = e => {
        if (e.shiftKey) {
            e.preventDefault();
        }
    };

    const getTestColor = () => {
        if (totalTests === 0) return 'text-gray-400';
        if (passRate === 100) return 'text-green-400';
        if (passRate >= 80) return 'text-yellow-400';
        return 'text-red-400';
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { 
                threshold: 0,
                rootMargin: '100px' // Keep cards rendered 100px outside viewport
            }
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={cardRef}
            className={`w-full h-[20rem] bg-gradient-to-br from-gray-800/95 to-gray-900 border ${
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
            } transition-all cursor-pointer overflow-hidden`}
            onClick={handleClick}
            onMouseDown={handleMouseDown}>
            {isVisible ? (
                <div className='p-6 flex flex-col h-full'>
                {/* Header Section */}
                <div className='flex-none'>
                    <div className='flex justify-between items-start'>
                        <div className='flex items-center gap-3 flex-wrap'>
                            <h3 className='text-base font-bold text-gray-100'>
                                {pattern.name}
                            </h3>
                            {pattern.tags && pattern.tags.length > 0 && (
                                <div className='flex flex-wrap gap-2'>
                                    {pattern.tags.map(tag => (
                                        <span
                                            key={tag}
                                            className='bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded text-xs shadow-sm'>
                                            {tag}
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

                    {/* Pattern Display */}
                    <div className='mt-4 bg-gray-900/50 rounded-md p-3 font-mono text-xs border border-gray-700/50'>
                        <code className='text-gray-200 break-all line-clamp-3'>
                            {pattern.pattern}
                        </code>
                    </div>
                </div>

                <hr className='border-gray-700 my-3' />

                {/* Description and Footer Section */}
                <div className='flex-1 overflow-hidden'>
                    {pattern.description && (
                        <div
                            className='text-gray-300 text-xs h-full overflow-y-auto prose prose-invert prose-gray max-w-none
                            [&>ul]:list-disc [&>ul]:ml-4 [&>ul]:mt-2 [&>ul]:mb-4
                            [&>ol]:list-decimal [&>ol]:ml-4 [&>ol]:mt-2 [&>ol]:mb-4
                            [&>ul>li]:mt-0.5 [&>ol>li]:mt-0.5
                            [&_code]:bg-gray-900/50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-blue-300 [&_code]:border [&_code]:border-gray-700/50 scrollable'>
                            <ReactMarkdown>{pattern.description}</ReactMarkdown>
                        </div>
                    )}
                </div>

                <hr className='border-gray-700 my-3' />

                <div className='flex items-center justify-between'>
                    <div className='flex items-center'>
                        {totalTests > 0 ? (
                            <div
                                className={`px-2.5 py-1 rounded-md flex items-center gap-2 ${
                                    passRate === 100
                                        ? 'bg-green-500/10 text-green-400'
                                        : passRate >= 80
                                        ? 'bg-yellow-500/10 text-yellow-400'
                                        : 'bg-red-500/10 text-red-400'
                                }`}>
                                <FlaskConical className='w-3.5 h-3.5' />
                                <span className='text-xs font-medium'>
                                    {passedTests}/{totalTests} passing
                                </span>
                            </div>
                        ) : (
                            <div className='px-2.5 py-1 rounded-md bg-gray-500/10 text-gray-400 flex items-center gap-2'>
                                <FlaskConical className='w-3.5 h-3.5' />
                                <span className='text-xs font-medium'>
                                    No tests
                                </span>
                            </div>
                        )}
                    </div>

                    {sortBy === 'dateModified' && pattern.modified_date && (
                        <span className='text-xs text-gray-400'>
                            Modified {formatDate(pattern.modified_date)}
                        </span>
                    )}
                </div>
            </div>
            ) : (
                <div className='p-6 flex items-center justify-center h-full'>
                    <div className='w-full space-y-3'>
                        <div className='h-6 bg-gray-700/50 rounded animate-pulse'/>
                        <div className='h-20 bg-gray-700/50 rounded animate-pulse'/>
                        <div className='h-4 bg-gray-700/50 rounded animate-pulse w-3/4'/>
                    </div>
                </div>
            )}
        </div>
    );
};

RegexCard.propTypes = {
    pattern: PropTypes.shape({
        name: PropTypes.string.isRequired,
        pattern: PropTypes.string.isRequired,
        description: PropTypes.string,
        tags: PropTypes.arrayOf(PropTypes.string),
        tests: PropTypes.arrayOf(
            PropTypes.shape({
                input: PropTypes.string.isRequired,
                expected: PropTypes.bool.isRequired,
                passes: PropTypes.bool.isRequired
            })
        ),
        modified_date: PropTypes.string
    }).isRequired,
    onEdit: PropTypes.func.isRequired,
    onClone: PropTypes.func.isRequired,
    formatDate: PropTypes.func.isRequired,
    sortBy: PropTypes.string.isRequired,
    isSelectionMode: PropTypes.bool.isRequired,
    isSelected: PropTypes.bool.isRequired,
    willBeSelected: PropTypes.bool,
    onSelect: PropTypes.func.isRequired
};

export default RegexCard;
