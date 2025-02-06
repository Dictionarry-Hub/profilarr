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

        try {
            const data = {
                name,
                pattern: patternValue,
                description,
                tags,
                tests
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
                const updatedTests = await runTests(pattern, tests);
                if (updatedTests) {
                    setTests(updatedTests);
                }
            } catch (error) {
                console.error('Error running tests:', error);
                Alert.error(
                    error.message || 'Failed to run tests. Please try again.'
                );
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
