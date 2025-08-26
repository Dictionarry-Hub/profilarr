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
    const [testResults, setTestResults] = useState({});

    // Wrapped run tests function that stores results
    const handleRunTests = useCallback(async (testPattern, testData) => {
        const results = await onRunTests(testPattern, testData);
        if (results && Array.isArray(results)) {
            // Store results by test ID
            const resultsMap = {};
            results.forEach(result => {
                resultsMap[result.id] = result;
            });
            setTestResults(resultsMap);
        }
        return results;
    }, [onRunTests]);

    useEffect(() => {
        // Run tests when pattern or tests change
        if (tests?.length > 0 && pattern && !isRunningTests) {
            handleRunTests(pattern, tests);
        }
    }, [pattern]); // Only re-run when pattern changes

    const handleAddOrUpdateTest = useCallback(
        testData => {
            let updatedTests;
            if (editingTest) {
                updatedTests = tests.map(test =>
                    test.id === testData.id ? testData : test
                );
            } else {
                updatedTests = [...tests, testData];
            }
            onTestsChange(updatedTests);
            // Run tests automatically after adding/updating
            if (pattern) {
                handleRunTests(pattern, updatedTests);
            }
            setEditingTest(null);
        },
        [tests, onTestsChange, handleRunTests, pattern, editingTest]
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
    const passedTests = tests?.filter(test => {
        const result = testResults[test.id];
        return result?.passes;
    })?.length || 0;

    return (
        <div className='flex flex-col h-full'>
            {/* Header */}
            <div className='flex items-center justify-between pb-4'>
                <div>
                    <h2 className='text-xl font-semibold text-gray-900 dark:text-white mb-1'>
                        Unit Tests
                    </h2>
                    {totalTests > 0 && (
                        <p className='text-sm text-gray-600 dark:text-gray-400'>
                            {passedTests} of {totalTests} tests passing
                            {totalTests > 0 && ` (${Math.round((passedTests / totalTests) * 100)}%)`}
                        </p>
                    )}
                </div>
                <div className='flex items-center gap-2'>
                    {tests?.length > 0 && (
                        <button
                            onClick={() => handleRunTests(pattern, tests)}
                            disabled={isRunningTests}
                            className='inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 disabled:opacity-50 transition-colors'>
                            {isRunningTests ? (
                                <Loader className='w-3.5 h-3.5 text-yellow-500 animate-spin' />
                            ) : (
                                <Play className='w-3.5 h-3.5 text-green-500' />
                            )}
                            <span>Run Tests</span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className='inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors'>
                        <Plus className='w-3.5 h-3.5 text-blue-500' />
                        <span>Add Test</span>
                    </button>
                </div>
            </div>
            
            {/* Progress Bar */}
            {totalTests > 0 && (
                <div className='mb-4'>
                    <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                        <div 
                            className='h-full bg-emerald-500 transition-all duration-500 ease-out'
                            style={{width: `${(passedTests / totalTests) * 100}%`}}
                        />
                    </div>
                </div>
            )}

            {/* Test List */}
            <div className='flex-1 overflow-y-auto pr-2'>
                {tests?.length > 0 ? (
                    <div className='space-y-3'>
                        {tests.map(test => {
                            // Merge saved test with runtime results
                            const testWithResults = {
                                ...test,
                                ...testResults[test.id]
                            };
                            return (
                                <UnitTest
                                    key={test.id}
                                    test={testWithResults}
                                    pattern={pattern}
                                    onDelete={() => handleDeleteTest(test.id)}
                                    onEdit={() => handleEditTest(test)}
                                />
                            );
                        })}
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
            expected: PropTypes.bool.isRequired
        })
    ),
    onTestsChange: PropTypes.func.isRequired,
    isRunningTests: PropTypes.bool.isRequired,
    onRunTests: PropTypes.func.isRequired
};

export default RegexTestingTab;
