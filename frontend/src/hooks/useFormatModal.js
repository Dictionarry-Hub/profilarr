import {useState, useCallback} from 'react';
import {CustomFormats} from '@api/data';
import Alert from '@ui/Alert';
import {useFormatTesting} from './useFormatTesting';

export const useFormatModal = (initialFormat, onSuccess) => {
    // Form state
    const [name, setName] = useState('');
    const [originalName, setOriginalName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState([]);
    const [conditions, setConditions] = useState([]);
    const [tests, setTests] = useState([]);
    const [isCloning, setIsCloning] = useState(false);

    // Enhanced UI state with field-specific errors
    const [formErrors, setFormErrors] = useState({
        name: '',
        conditions: '',
        tests: '',
        general: ''
    });
    const [activeTab, setActiveTab] = useState('general');
    const [isDeleting, setIsDeleting] = useState(false);

    // Initialize testing functionality
    const {isRunningTests, runTests} = useFormatTesting();

    const validateForm = () => {
        const errors = {
            name: '',
            conditions: '',
            tests: '',
            general: ''
        };

        // Name validation
        if (!name.trim()) {
            errors.name = 'Name is required';
        } else if (name.length > 64) {
            errors.name = 'Name must be less than 64 characters';
        }

        // Conditions validation
        if (!conditions.length) {
            errors.conditions = 'At least one condition is required';
        } else {
            const invalidConditions = conditions.filter(condition => {
                return !condition.field || !condition.operator;
            });
            if (invalidConditions.length > 0) {
                errors.conditions =
                    'All conditions must have a field and operator';
            }
        }

        // Test validation
        if (tests.length > 0) {
            const invalidTests = tests.filter(test => !test.input);
            if (invalidTests.length > 0) {
                errors.tests = 'All tests must have input values';
            }
        }

        setFormErrors(errors);
        return !Object.values(errors).some(error => error);
    };

    const initializeForm = useCallback((format, cloning) => {
        setIsCloning(cloning || false);
        if (format) {
            const initialName = cloning ? `${format.name}` : format.name;
            setName(initialName);
            setOriginalName(cloning ? '' : format.name);
            setDescription(format.description || '');
            setTags(format.tags || []);
            setConditions(format.conditions || []);
            setTests(format.tests || []);
        } else {
            setName('');
            setOriginalName('');
            setDescription('');
            setTags([]);
            setConditions([]);
            setTests([]);
        }
        setFormErrors({name: '', conditions: '', tests: '', general: ''});
        setIsDeleting(false);
    }, []);

    const handleSave = async () => {
        try {
            // Validate form directly without state updates
            const errors = {
                name: '',
                conditions: '',
                tests: '',
                general: ''
            };

            // Name validation
            if (!name.trim()) {
                errors.name = 'Name is required';
                Alert.error('Name is required');
                setFormErrors(errors);
                return;
            }

            // Conditions validation
            if (!conditions.length) {
                errors.conditions = 'At least one condition is required';
                Alert.error('At least one condition is required');
                setFormErrors(errors);
                return;
            }

            const invalidConditions = conditions.filter(condition => {
                // Each condition must have a type
                if (!condition.type) return true;

                // Validation based on condition type
                switch (condition.type) {
                    case 'release_title':
                    case 'release_group':
                    case 'edition':
                        return !condition.pattern;
                    case 'language':
                        return !condition.language;
                    case 'indexer_flag':
                        return !condition.flag;
                    case 'source':
                        return !condition.source;
                    case 'resolution':
                        return !condition.resolution;
                    case 'quality_modifier':
                        return !condition.qualityModifier;
                    case 'size':
                        return !condition.minSize && !condition.maxSize;
                    case 'release_type':
                        return !condition.releaseType;
                    case 'year':
                        return !condition.minYear && !condition.maxYear;
                    default:
                        return true;
                }
            });

            if (invalidConditions.length > 0) {
                errors.conditions =
                    'All conditions must have required fields filled out';
                Alert.error(
                    'All conditions must have required fields filled out'
                );
                setFormErrors(errors);
                return;
            }

            // If we get here, form is valid
            const data = {
                name,
                description,
                tags,
                conditions,
                tests
            };

            if (initialFormat && !isCloning) {
                const hasNameChanged = name !== originalName;
                await CustomFormats.update(
                    initialFormat.file_name.replace('.yml', ''),
                    data,
                    hasNameChanged ? name : undefined
                );
                Alert.success('Format updated successfully');
            } else {
                await CustomFormats.create(data);
                Alert.success('Format created successfully');
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving format:', error);

            // Handle different types of errors
            if (error.message.includes('reserved word')) {
                setFormErrors(prev => ({...prev, name: error.message}));
                Alert.error(error.message);
            } else if (error.message.includes('invalid characters')) {
                setFormErrors(prev => ({...prev, name: error.message}));
                Alert.error(error.message);
            } else if (error.message.includes('already exists')) {
                setFormErrors(prev => ({...prev, name: error.message}));
                Alert.error(error.message);
            } else if (error.message.includes('condition')) {
                setFormErrors(prev => ({...prev, conditions: error.message}));
                Alert.error(error.message);
            } else if (error.message.includes('test')) {
                setFormErrors(prev => ({...prev, tests: error.message}));
                Alert.error(error.message);
            } else {
                setFormErrors(prev => ({
                    ...prev,
                    general:
                        error.message ||
                        'Failed to save format. Please try again.'
                }));
                Alert.error(
                    error.message || 'Failed to save format. Please try again.'
                );
            }
        }
    };

    const handleDelete = async () => {
        if (!initialFormat) return;

        if (isDeleting) {
            try {
                await CustomFormats.delete(
                    initialFormat.file_name.replace('.yml', '')
                );
                Alert.success('Format deleted successfully');
                onSuccess();
            } catch (error) {
                console.error('Error deleting format:', error);
                Alert.error(
                    error.response?.data?.error ||
                        'Failed to delete format. Please try again.'
                );
                setIsDeleting(false);
            }
        } else {
            setIsDeleting(true);
        }
    };

    const handleRunTests = useCallback(
        async (conditions, tests) => {
            try {
                const updatedTests = await runTests(conditions, tests);
                if (updatedTests) {
                    setTests(updatedTests);
                }
            } catch (error) {
                console.error('Error running tests:', error);
                setFormErrors(prev => ({
                    ...prev,
                    tests:
                        error.message ||
                        'Failed to run tests. Please try again.'
                }));
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
        tags,
        conditions,
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
        setTags,
        setConditions,
        setTests,
        setActiveTab,
        setIsDeleting,
        // Main handlers
        initializeForm,
        handleSave,
        handleDelete,
        handleRunTests,
        // Validation
        validateForm
    };
};
