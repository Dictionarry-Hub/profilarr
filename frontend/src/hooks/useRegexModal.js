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

    // UI state
    const [error, setError] = useState('');
    const [patternError, setPatternError] = useState('');
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
        setError('');
        setPatternError('');
        setIsDeleting(false);
    }, []);

    const handleSave = async () => {
        try {
            const data = {
                name,
                pattern: patternValue,
                description,
                tags,
                tests
            };

            // Validation checks
            if (!name.trim()) {
                Alert.error('Name is required');
                return;
            }
            if (!patternValue.trim()) {
                Alert.error('Pattern is required');
                return;
            }

            if (initialPattern && !isCloning) {
                // Check if name has changed
                const hasNameChanged = name !== originalName;
                await RegexPatterns.update(
                    initialPattern.file_name.replace('.yml', ''),
                    data,
                    hasNameChanged ? name : undefined // Only pass new name if it changed
                );
                Alert.success('Pattern updated successfully');
            } else {
                await RegexPatterns.create(data);
                Alert.success('Pattern created successfully');
            }
            onSave();
        } catch (error) {
            console.error('Error saving pattern:', error);
            Alert.error('Failed to save pattern. Please try again.');
        }
    };

    const handleRunTests = useCallback(
        async (pattern, tests) => {
            const updatedTests = await runTests(pattern, tests);
            if (updatedTests) {
                setTests(updatedTests);
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
        error,
        patternError,
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
