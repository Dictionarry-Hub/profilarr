import React, {useState, useCallback, useEffect} from 'react';
import PropTypes from 'prop-types';
import {Plus, Loader, Play} from 'lucide-react';
import UnitTest from './UnitTest';
import AddUnitTestModal from './AddUnitTestModal';

const RegexTestingTab = ({
    pattern,
    tests,
    onTestsChange,
    isRunningTests,
    onRunTests
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTest, setEditingTest] = useState(null);

    useEffect(() => {
        const needsAutoRun =
            tests?.length > 0 &&
            pattern &&
            tests.some(test => test.passes !== undefined && !test.matchSpan);

        if (needsAutoRun && !isRunningTests) {
            onRunTests(pattern, tests);
        }
    }, []);

    const handleAddOrUpdateTest = useCallback(
        testData => {
            let updatedTests;
            if (editingTest) {
                updatedTests = tests.map(test =>
                    test.id === testData.id
                        ? {
                              ...testData,
                              passes: false,
                              lastRun: null,
                              matchedContent: null,
                              matchSpan: null,
                              matchedGroups: []
                          }
                        : test
                );
            } else {
                updatedTests = [
                    ...tests,
                    {
                        ...testData,
                        passes: false,
                        lastRun: null,
                        matchedContent: null,
                        matchSpan: null,
                        matchedGroups: []
                    }
                ];
            }
            onTestsChange(updatedTests);
            onRunTests(pattern, updatedTests);
            setEditingTest(null);
        },
        [tests, onTestsChange, onRunTests, pattern, editingTest]
    );

    const handleEditTest = useCallback(test => {
        setEditingTest(test);
        setIsModalOpen(true);
    }, []);

    const handleDeleteTest = useCallback(
        testId => {
            const updatedTests = tests.filter(test => test.id !== testId);
            onTestsChange(updatedTests);
        },
        [tests, onTestsChange]
    );

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingTest(null);
    }, []);

    const totalTests = tests?.length || 0;
    const passedTests = tests?.filter(test => test.passes)?.length || 0;

    return (
        <div className='flex flex-col h-full'>
            {/* Header with Progress Bar */}
            <div className='flex items-center justify-between pb-4 pr-2'>
                <div>
                    <h2 className='text-xl font-semibold text-gray-900 dark:text-white mb-3'>
                        Unit Tests
                    </h2>
                    <div className='flex items-center gap-3'>
                        <div className='h-1.5 w-32 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                            <div
                                className='h-full bg-emerald-500 rounded-full transition-all duration-300'
                                style={{
                                    width: `${
                                        totalTests
                                            ? (passedTests / totalTests) * 100
                                            : 0
                                    }%`
                                }}
                            />
                        </div>
                        <span className='text-sm text-gray-600 dark:text-gray-300'>
                            {totalTests > 0
                                ? `${passedTests}/${totalTests} tests passing`
                                : 'No tests added yet'}
                        </span>
                    </div>
                </div>
                <div className='flex items-center gap-2'>
                    {tests?.length > 0 && (
                        <button
                            onClick={() => onRunTests(pattern, tests)}
                            disabled={isRunningTests}
                            className='inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white'>
                            {isRunningTests ? (
                                <Loader className='w-4 h-4 mr-2 animate-spin' />
                            ) : (
                                <Play className='w-4 h-4 mr-2' />
                            )}
                            Run Tests
                        </button>
                    )}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className='inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white'>
                        <Plus className='w-4 h-4 mr-2' />
                        Add Test
                    </button>
                </div>
            </div>

            {/* Test List */}
            <div className='flex-1 overflow-y-auto pr-2'>
                {tests?.length > 0 ? (
                    <div className='space-y-3'>
                        {tests.map(test => (
                            <UnitTest
                                key={test.id}
                                test={test}
                                pattern={pattern}
                                onDelete={() => handleDeleteTest(test.id)}
                                onEdit={() => handleEditTest(test)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className='text-center py-12 rounded-lg'>
                        <p className='text-gray-500 dark:text-gray-400'>
                            No tests added yet
                        </p>
                    </div>
                )}
            </div>

            <AddUnitTestModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onAdd={handleAddOrUpdateTest}
                editTest={editingTest}
                tests={tests}
            />
        </div>
    );
};

RegexTestingTab.propTypes = {
    pattern: PropTypes.string.isRequired,
    tests: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            input: PropTypes.string.isRequired,
            expected: PropTypes.bool.isRequired,
            passes: PropTypes.bool.isRequired,
            lastRun: PropTypes.string,
            matchedContent: PropTypes.string,
            matchedGroups: PropTypes.arrayOf(PropTypes.string),
            matchSpan: PropTypes.shape({
                start: PropTypes.number,
                end: PropTypes.number
            })
        })
    ),
    onTestsChange: PropTypes.func.isRequired,
    isRunningTests: PropTypes.bool.isRequired,
    onRunTests: PropTypes.func.isRequired
};

export default RegexTestingTab;
