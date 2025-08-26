// useRegexTesting.js
import {useState, useCallback} from 'react';
import {RegexPatterns} from '@api/data';
import Alert from '@ui/Alert';

export const useRegexTesting = onUpdateTests => {
    const [isRunningTests, setIsRunningTests] = useState(false);

    const runTests = useCallback(
        async (pattern, tests) => {
            if (!pattern?.trim() || !tests?.length) {
                return tests;
            }
            setIsRunningTests(true);
            try {
                // Format the data properly as a single object
                const result = await RegexPatterns.runTests({
                    pattern: pattern,
                    tests: tests
                });
                if (result.success) {
                    // Calculate test statistics
                    const totalTests = result.tests.length;
                    const passedTests = result.tests.filter(
                        test => test.passes
                    ).length;

                    // Show success message with statistics
                    Alert.success(
                        `Tests completed: ${passedTests}/${totalTests} passed`,
                        {
                            autoClose: 3000,
                            hideProgressBar: false
                        }
                    );

                    // Return the test results (with match information)
                    // Don't save these results, just return them for display
                    return result.tests;
                } else {
                    Alert.error(result.message || 'Failed to run tests');
                    return null;
                }
            } catch (error) {
                console.error('Error running tests:', error);
                Alert.error('An error occurred while running tests');
                return tests;
            } finally {
                setIsRunningTests(false);
            }
        },
        [onUpdateTests]
    );

    return {
        isRunningTests,
        runTests
    };
};
