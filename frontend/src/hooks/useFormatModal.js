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

    // UI state
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('general');
    const [isDeleting, setIsDeleting] = useState(false);

    // Initialize testing functionality
    const {isRunningTests, runTests} = useFormatTesting();

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
        setError('');
        setIsDeleting(false);
    }, []);

    const handleSave = async () => {
        try {
            const data = {
                name,
                description,
                tags,
                conditions,
                tests
            };

            if (!name.trim()) {
                Alert.error('Name is required');
                return;
            }

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
            Alert.error('Failed to save format. Please try again.');
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
                    error.message ||
                        'Failed to delete format. Please try again.'
                );
                setIsDeleting(false); // Reset delete state on error
            }
        } else {
            setIsDeleting(true);
        }
    };

    const handleRunTests = useCallback(
        async (conditions, tests) => {
            const updatedTests = await runTests(conditions, tests);
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
        tags,
        conditions,
        tests,
        // UI state
        error,
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
        handleRunTests
    };
};
