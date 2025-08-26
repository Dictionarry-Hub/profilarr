import React, {useState, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import {Copy, Check, FlaskConical, FileText, ListFilter} from 'lucide-react';
import Tooltip from '@ui/Tooltip';
import ReactMarkdown from 'react-markdown';

function FormatCard({
    format,
    onEdit,
    onClone,
    sortBy,
    isSelectionMode,
    isSelected,
    willBeSelected,
    onSelect
}) {
    const [isVisible, setIsVisible] = useState(false);
    const cardRef = useRef(null);
    const [showDescription, setShowDescription] = useState(() => {
        const saved = localStorage.getItem(`format-view-${format.file_name}`);
        return saved !== null ? JSON.parse(saved) : true;
    });
    const {content} = format;
    const totalTests = content.tests?.length || 0;
    const passedTests = content.tests?.filter(t => t.passes)?.length || 0;
    const passRate = Math.round((passedTests / totalTests) * 100) || 0;

    const getConditionStyle = condition => {
        if (condition.negate) {
            return 'bg-red-500/20 text-red-400 border border-red-500/20';
        }
        if (condition.required) {
            return 'bg-green-500/20 text-green-400 border border-green-500/20';
        }
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/20';
    };

    const handleClick = e => {
        if (isSelectionMode) {
            onSelect(e);
        } else {
            onEdit();
        }
    };

    const handleCloneClick = e => {
        e.stopPropagation();
        onClone(format);
    };

    const handleViewToggle = e => {
        e.stopPropagation();
        setShowDescription(prev => {
            const newState = !prev;
            localStorage.setItem(
                `format-view-${format.file_name}`,
                JSON.stringify(newState)
            );
            return newState;
        });
    };

    const handleMouseDown = e => {
        if (e.shiftKey) {
            e.preventDefault();
        }
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
            className={`w-full h-[12rem] bg-gradient-to-br from-gray-800/95 to-gray-900 border ${
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
            } transition-all cursor-pointer relative`}
            onClick={handleClick}
            onMouseDown={handleMouseDown}>
            {isVisible ? (
                <div className='p-4 flex flex-col h-full'>
                {/* Header Section */}
                <div className='flex justify-between items-start'>
                    <div className='flex flex-col min-w-0 flex-1'>
                        <h3 className='text-base font-bold text-gray-100 truncate mb-1.5'>
                            {content.name}
                        </h3>
                        <div className='flex-1 overflow-x-auto scrollbar-none'>
                            <div className='flex items-center gap-2 text-xs'>
                                {content.tags?.map(tag => (
                                    <span
                                        key={tag}
                                        className='bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap'>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className='flex items-center gap-2 shrink-0 ml-4'>
                        <Tooltip
                            content={
                                showDescription
                                    ? 'Show Conditions'
                                    : 'Show Description'
                            }>
                            <button
                                onClick={handleViewToggle}
                                className='w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white relative'>
                                {showDescription ? (
                                    <ListFilter className='w-4 h-4' />
                                ) : (
                                    <FileText className='w-4 h-4' />
                                )}
                            </button>
                        </Tooltip>
                        {!isSelectionMode && (
                            <button
                                onClick={handleCloneClick}
                                className='text-gray-400 hover:text-white transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700/50 relative'>
                                <Copy className='w-4 h-4' />
                            </button>
                        )}
                        {isSelectionMode && (
                            <Tooltip
                                content={
                                    isSelected
                                        ? 'Selected'
                                        : willBeSelected
                                        ? 'Will be selected'
                                        : 'Select'
                                }>
                                <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center relative ${
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
                        )}
                    </div>
                </div>

                <hr className='border-gray-700 my-2' />

                {/* Content Area with Slide Animation */}
                <div className='relative flex-1 overflow-hidden'>
                    <div
                        className={`absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out flex ${
                            showDescription
                                ? '-translate-x-full'
                                : 'translate-x-0'
                        }`}>
                        {/* Conditions */}
                        <div className='w-full flex-shrink-0 overflow-y-auto scrollable'>
                            <div className='flex flex-wrap gap-1.5 content-start'>
                                {content.conditions?.map((condition, index) => (
                                    <span
                                        key={index}
                                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${getConditionStyle(
                                            condition
                                        )}`}>
                                        {condition.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div
                        className={`absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out ${
                            showDescription
                                ? 'translate-x-0'
                                : 'translate-x-full'
                        }`}>
                        {/* Description */}
                        <div className='w-full h-full overflow-y-auto scrollable'>
                            {content.description ? (
                                <div className='text-gray-300 text-xs prose prose-invert prose-gray max-w-none'>
                                    <ReactMarkdown>
                                        {content.description}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <span className='text-gray-500 text-xs italic'>
                                    No description provided
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <hr className='border-gray-700 my-2' />

                {/* Footer - Tests */}
                <div className='flex items-center justify-between text-xs'>
                    {totalTests > 0 ? (
                        <div
                            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                                passRate === 100
                                    ? 'bg-green-500/10 text-green-400'
                                    : passRate >= 80
                                    ? 'bg-yellow-500/10 text-yellow-400'
                                    : 'bg-red-500/10 text-red-400'
                            }`}>
                            <FlaskConical className='w-3.5 h-3.5' />
                            <span className='font-medium'>
                                {passedTests}/{totalTests} passing
                            </span>
                        </div>
                    ) : (
                        <div className='px-2.5 py-1 rounded-md bg-gray-500/10 text-gray-400 flex items-center gap-1.5'>
                            <FlaskConical className='w-3.5 h-3.5' />
                            <span className='font-medium'>No tests</span>
                        </div>
                    )}
                    {sortBy === 'dateModified' && format.modified_date && (
                        <span className='text-gray-400'>
                            Modified:{' '}
                            {new Date(format.modified_date).toLocaleString()}
                        </span>
                    )}
                </div>
            </div>
            ) : (
                <div className='p-4 flex items-center justify-center h-full'>
                    <div className='w-full space-y-2'>
                        <div className='h-5 bg-gray-700/50 rounded animate-pulse'/>
                        <div className='h-3 bg-gray-700/50 rounded animate-pulse w-3/4'/>
                        <div className='h-3 bg-gray-700/50 rounded animate-pulse w-1/2'/>
                    </div>
                </div>
            )}
        </div>
    );
}

FormatCard.propTypes = {
    format: PropTypes.shape({
        file_name: PropTypes.string.isRequired,
        modified_date: PropTypes.string.isRequired,
        content: PropTypes.shape({
            name: PropTypes.string.isRequired,
            description: PropTypes.string,
            conditions: PropTypes.arrayOf(
                PropTypes.shape({
                    name: PropTypes.string.isRequired,
                    type: PropTypes.string.isRequired,
                    pattern: PropTypes.string,
                    required: PropTypes.bool,
                    negate: PropTypes.bool
                })
            ),
            tags: PropTypes.arrayOf(PropTypes.string),
            tests: PropTypes.arrayOf(
                PropTypes.shape({
                    id: PropTypes.number.isRequired,
                    input: PropTypes.string.isRequired,
                    expected: PropTypes.bool.isRequired,
                    passes: PropTypes.bool.isRequired
                })
            )
        }).isRequired
    }).isRequired,
    onEdit: PropTypes.func.isRequired,
    onClone: PropTypes.func.isRequired,
    sortBy: PropTypes.string.isRequired,
    isSelectionMode: PropTypes.bool.isRequired,
    isSelected: PropTypes.bool.isRequired,
    willBeSelected: PropTypes.bool,
    onSelect: PropTypes.func.isRequired
};

export default FormatCard;
