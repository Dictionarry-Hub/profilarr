import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {Trash2, Pencil} from 'lucide-react';
import DeleteConfirmationModal from '@ui/DeleteConfirmationModal';

const MatchHighlight = ({input, pattern, test}) => {
    if (!pattern) return <span className='font-mono'>{input}</span>;

    try {
        const regex = new RegExp(pattern, 'g');
        const matches = [];
        let match;

        while ((match = regex.exec(input)) !== null) {
            // Avoid infinite loops with zero-length matches
            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            matches.push(match);
        }

        if (!matches.length) {
            return <span className='font-mono text-gray-100'>{input}</span>;
        }

        let segments = [];
        let lastIndex = 0;

        matches.forEach(match => {
            let matchText = '';
            let matchStart = match.index;

            // Use capturing groups if they exist
            let capturingGroupIndex = 1;
            while (
                capturingGroupIndex < match.length &&
                !match[capturingGroupIndex]
            ) {
                capturingGroupIndex++;
            }
            if (capturingGroupIndex < match.length) {
                matchText = match[capturingGroupIndex];

                // Find the position of matchText in the input, starting from match.index
                matchStart = input.indexOf(matchText, match.index);

                if (matchStart === -1) {
                    // If not found, skip this match
                    return;
                }
            } else {
                // No capturing group match, use full match
                matchText = match[0];
            }

            // Add non-highlighted segment before the match
            if (matchStart > lastIndex) {
                segments.push({
                    text: input.slice(lastIndex, matchStart),
                    highlight: false
                });
            }

            // Add the highlighted match
            if (matchText.length > 0) {
                segments.push({
                    text: matchText,
                    highlight: true
                });
                lastIndex = matchStart + matchText.length;
            } else {
                // Handle zero-length matches
                lastIndex = matchStart;
            }
        });

        // Add any remaining non-highlighted text
        if (lastIndex < input.length) {
            segments.push({
                text: input.slice(lastIndex),
                highlight: false
            });
        }

        return (
            <span className='font-mono'>
                <span className='bg-green-900/20 rounded px-0.5'>
                    {segments.map((segment, idx) => (
                        <span
                            key={idx}
                            className={
                                segment.highlight
                                    ? test.passes
                                        ? 'bg-emerald-200 dark:bg-emerald-600 text-emerald-900 dark:text-emerald-100 px-0.5 rounded'
                                        : 'bg-red-200 dark:bg-red-600 text-red-900 dark:text-red-100 px-0.5 rounded'
                                    : 'text-gray-100'
                            }>
                            {segment.text}
                        </span>
                    ))}
                </span>
            </span>
        );
    } catch (error) {
        console.error('Regex error:', error);
        return <span className='font-mono text-gray-100'>{input}</span>;
    }
};

const UnitTest = ({test, pattern, onDelete, onEdit}) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = () => {
        onDelete();
        setShowDeleteModal(false);
    };

    return (
        <>
            <div
                className={`
          relative rounded-lg border group
          ${
              test.passes
                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
          }
        `}>
                {/* Header */}
                <div className='px-4 py-2 pr-2 flex items-center justify-between border-b border-inherit'>
                    <div className='flex items-center gap-2'>
                        <div
                            className={`
                w-2 h-2 rounded-full
                ${
                    test.passes
                        ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                        : 'bg-red-500 shadow-sm shadow-red-500/50'
                }
              `}
                        />
                        <span
                            className={`text-xs font-medium
                ${
                    test.passes
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-red-700 dark:text-red-300'
                }
              `}>
                            {test.expected
                                ? 'Should Match'
                                : 'Should Not Match'}
                        </span>
                    </div>
                    <div className='flex items-center gap-2'>
                        <span className='text-xs text-gray-500 dark:text-gray-400'>
                            Last run: {test.lastRun}
                        </span>
                        <div className='flex gap-2'>
                            <button
                                onClick={onEdit}
                                className='p-1 rounded shrink-0 transition-transform transform hover:scale-110'>
                                <Pencil className='w-4 h-4 text-gray-500 dark:text-gray-400' />
                            </button>
                            <button
                                onClick={handleDeleteClick}
                                className='p-1 rounded shrink-0 transition-transform transform hover:scale-110'>
                                <Trash2 className='w-4 h-4 text-gray-500 dark:text-gray-400' />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className='p-2 flex items-start gap-3'>
                    <div className='flex-1 min-w-0'>
                        <div className='rounded bg-white/75 dark:bg-black/25 px-2 py-1.5 text-xs'>
                            <MatchHighlight
                                input={test.input}
                                pattern={pattern}
                                test={test}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleConfirmDelete}
            />
        </>
    );
};

UnitTest.propTypes = {
    test: PropTypes.shape({
        id: PropTypes.number.isRequired,
        input: PropTypes.string.isRequired,
        expected: PropTypes.bool.isRequired,
        passes: PropTypes.bool.isRequired,
        lastRun: PropTypes.string
    }).isRequired,
    pattern: PropTypes.string.isRequired,
    onDelete: PropTypes.func.isRequired,
    onEdit: PropTypes.func.isRequired
};

MatchHighlight.propTypes = {
    input: PropTypes.string.isRequired,
    pattern: PropTypes.string.isRequired,
    test: PropTypes.shape({
        passes: PropTypes.bool.isRequired
    }).isRequired
};

export default UnitTest;
