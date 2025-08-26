import {useState, useCallback} from 'react';
import {RegexPatterns} from '@api/data';
import Alert from '@ui/Alert';
import {useRegexTesting} from './useRegexTesting';

export const useRegexModal = (initialPattern, onSave) => {
    // Form state
    const [name, setName] = useState('');
    const [originalName, setOriginalName] = useState('');
    const [description, setDescription] = useState('');
    const [patternValue, setPatternValue] = useState('');
    const [tags, setTags] = useState([]);
    const [tests, setTests] = useState([]);
    const [isCloning, setIsCloning] = useState(false);

    // UI state with more specific error handling
    const [formErrors, setFormErrors] = useState({
        name: '',
        pattern: '',
        general: ''
    });
    const [activeTab, setActiveTab] = useState('general');
    const [isDeleting, setIsDeleting] = useState(false);

    // Initialize testing functionality
    const {isRunningTests, runTests} = useRegexTesting();

    const initializeForm = useCallback((pattern, cloning) => {
        setIsCloning(cloning || false);
        if (pattern) {
            const initialName = cloning ? `${pattern.name}` : pattern.name;
            setName(initialName);
            setOriginalName(cloning ? '' : pattern.name);
            setDescription(pattern.description || '');
            setPatternValue(pattern.pattern || '');
            setTags(pattern.tags || []);
            setTests(pattern.tests || []);
        } else {
            setName('');
            setOriginalName('');
            setDescription('');
            setPatternValue('');
            setTags([]);
            setTests([]);
        }
        setFormErrors({name: '', pattern: '', general: ''});
        setIsDeleting(false);
    }, []);

    const handleSave = async () => {
        // Name validation
        if (!name.trim()) {
            Alert.error('Name is required');
            return;
        }

        if (name.length > 64) {
            Alert.error('Name must be less than 64 characters');
            return;
        }

        // Pattern validation
        if (!patternValue.trim()) {
            Alert.error('Pattern is required');
            return;
        }

        // Validate pattern with .NET regex engine
        try {
            const validationResult = await RegexPatterns.verify(patternValue);
            if (!validationResult.valid) {
                Alert.error(`Invalid regex pattern: ${validationResult.error || 'Pattern validation failed'}`);
                return;
            }
        } catch (error) {
            console.error('Pattern validation error:', error);
            Alert.error('Failed to validate pattern. Please check the pattern and try again.');
            return;
        }

        try {
            // Clean tests to only include saved data
            const cleanTests = tests.map((test, index) => ({
                id: test.id || index + 1,
                input: test.input,
                expected: test.expected
            }));
            
            const data = {
                name,
                pattern: patternValue,
                description,
                tags,
                tests: cleanTests
            };

            if (initialPattern && !isCloning) {
                const hasNameChanged = name !== originalName;
                await RegexPatterns.update(
                    initialPattern.file_name.replace('.yml', ''),
                    data,
                    hasNameChanged ? name : undefined
                );
                Alert.success('Pattern updated successfully');
            } else {
                await RegexPatterns.create(data);
                Alert.success('Pattern created successfully');
            }
            onSave();
        } catch (error) {
            console.error('Error saving pattern:', error);
            Alert.error(
                error.message || 'Failed to save pattern. Please try again.'
            );
        }
    };

    const handleRunTests = useCallback(
        async (pattern, tests) => {
            try {
                const testResults = await runTests(pattern, tests);
                // We don't update the tests state with results
                // Results are only used for display, not saved
                return testResults;
            } catch (error) {
                console.error('Error running tests:', error);
                Alert.error(
                    error.message || 'Failed to run tests. Please try again.'
                );
                return null;
            }
        },
        [runTests]
    );

    return {
        // Form state
        name,
        description,
        patternValue,
        tags,
        tests,

        // UI state
        formErrors,
        activeTab,
        isDeleting,
        isRunningTests,
        isCloning,

        // Actions
        setName,
        setDescription,
        setPatternValue,
        setTags,
        setTests,
        setActiveTab,
        setIsDeleting,

        // Main handlers
        initializeForm,
        handleSave,
        handleRunTests
    };
};
