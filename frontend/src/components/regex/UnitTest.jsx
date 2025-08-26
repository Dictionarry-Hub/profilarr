import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {Trash2, Pencil} from 'lucide-react';
import DeleteConfirmationModal from '@ui/DeleteConfirmationModal';

const UnitTest = ({test, pattern, onDelete, onEdit}) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const renderHighlightedInput = () => {
        if (!test.matchSpan) {
            return (
                <span className='font-mono text-gray-100'>{test.input}</span>
            );
        }

        const preMatch = test.input.slice(0, test.matchSpan.start);
        const match = test.input.slice(
            test.matchSpan.start,
            test.matchSpan.end
        );
        const postMatch = test.input.slice(test.matchSpan.end);

        return (
            <span className='font-mono'>
                <span className='text-gray-100'>{preMatch}</span>
                <span
                    className={`px-0.5 rounded ${
                        test.passes
                            ? 'bg-emerald-200 dark:bg-emerald-600 text-emerald-900 dark:text-emerald-100'
                            : 'bg-red-200 dark:bg-red-600 text-red-900 dark:text-red-100'
                    }`}>
                    {match}
                </span>
                <span className='text-gray-100'>{postMatch}</span>
            </span>
        );
    };

    return (
        <>
            <div
                className={`
                relative rounded-lg border group border border-gray-200 dark:border-gray-700
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
                    <div className='flex gap-2'>
                            <button
                                onClick={onEdit}
                                className='p-1 rounded shrink-0 transition-transform transform hover:scale-110'>
                                <Pencil className='w-4 h-4 text-gray-500 dark:text-gray-400' />
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className='p-1 rounded shrink-0 transition-transform transform hover:scale-110'>
                                <Trash2 className='w-4 h-4 text-gray-500 dark:text-gray-400' />
                            </button>
                    </div>
                </div>

                {/* Content */}
                <div className='p-2 flex items-start gap-3'>
                    <div className='flex-1 min-w-0'>
                        <div className='rounded bg-white/75 dark:bg-black/25 px-2 py-1.5 text-xs'>
                            {renderHighlightedInput()}
                        </div>
                    </div>
                </div>
            </div>

            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={onDelete}
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
        matchedContent: PropTypes.string,
        matchedGroups: PropTypes.arrayOf(PropTypes.string),
        matchSpan: PropTypes.shape({
            start: PropTypes.number,
            end: PropTypes.number
        })
    }).isRequired,
    pattern: PropTypes.string.isRequired,
    onDelete: PropTypes.func.isRequired,
    onEdit: PropTypes.func.isRequired
};

export default UnitTest;
