import {useState, useCallback} from 'react';
import {CustomFormats} from '@api/data';
import Alert from '@ui/Alert';

export const useFormatTesting = () => {
    const [isRunningTests, setIsRunningTests] = useState(false);

    const runTests = useCallback(async (conditions, tests) => {
        if (!conditions?.length || !tests?.length) {
            return tests;
        }

        setIsRunningTests(true);
        try {
            const result = await CustomFormats.runTests({conditions, tests});

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

                return result.tests;
            } else {
                Alert.error(result.message || 'Failed to run tests');
                return tests;
            }
        } catch (error) {
            console.error('Error running tests:', error);
            Alert.error('An error occurred while running tests');
            return tests;
        } finally {
            setIsRunningTests(false);
        }
    }, []);

    return {
        isRunningTests,
        runTests
    };
};
