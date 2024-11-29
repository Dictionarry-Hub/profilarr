import React, {useState, useEffect} from 'react';
import {Plus, TestTube, Loader, Save, Tag, X, Trash, Check} from 'lucide-react';
import Modal from '../../ui/Modal';
import Tooltip from '../../ui/Tooltip';
import Alert from '../../ui/Alert';
import {
    pingService,
    saveArrConfig,
    updateArrConfig,
    deleteArrConfig
} from '../../../api/arr';

const ArrModal = ({isOpen, onClose, onSubmit, editingArr}) => {
    const [formData, setFormData] = useState({
        name: '',
        type: 'radarr',
        tags: [],
        profilarrServer: '',
        arrServer: '',
        apiKey: ''
    });
    const [tagInput, setTagInput] = useState('');
    const [errors, setErrors] = useState({});
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [saveConfirm, setSaveConfirm] = useState(false);
    const [testConfirm, setTestConfirm] = useState(false);

    const arrTypes = [
        {value: 'radarr', label: 'Radarr'},
        {value: 'sonarr', label: 'Sonarr'}
    ];

    useEffect(() => {
        if (editingArr) {
            setFormData(editingArr);
        } else {
            setFormData({
                name: '',
                type: 'radarr', // Keep the default value
                tags: [],
                profilarrServer: '',
                arrServer: '',
                apiKey: ''
            });
        }
        setTagInput('');
        setErrors({});
        setDeleteConfirm(false);
        setSaveConfirm(false);
        setTestConfirm(false);
    }, [editingArr]);

    const validateUrl = url => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (
            formData.profilarrServer &&
            !validateUrl(formData.profilarrServer)
        ) {
            newErrors.profilarrServer =
                'Please enter a valid URL (e.g., http://localhost:7441)';
        }

        if (formData.arrServer && !validateUrl(formData.arrServer)) {
            newErrors.arrServer =
                'Please enter a valid URL (e.g., http://localhost:7878)';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleTestConnection = async () => {
        if (!validateForm()) return;

        if (testConfirm) {
            setIsTestingConnection(true);
            try {
                const result = await pingService(
                    formData.arrServer,
                    formData.apiKey,
                    formData.type
                );
                if (result.success) {
                    Alert.success('Connection successful!');
                } else {
                    // Check if the error is version related
                    if (result.message.includes('version')) {
                        Alert.error(
                            `Unsupported ${formData.type} version. ${result.message}`
                        );
                    } else {
                        Alert.error(`Connection failed: ${result.message}`);
                    }
                }
            } catch (error) {
                Alert.error('An error occurred while testing the connection.');
                console.error('Error testing connection:', error);
            } finally {
                setIsTestingConnection(false);
                setTestConfirm(false);
            }
        } else {
            setTestConfirm(true);
            setTimeout(() => setTestConfirm(false), 3000);
        }
    };

    const handleSubmit = async e => {
        e.preventDefault();
        if (!validateForm()) return;

        if (saveConfirm) {
            try {
                // Test connection with type verification
                const testResult = await pingService(
                    formData.arrServer,
                    formData.apiKey,
                    formData.type // Add type
                );

                if (!testResult.success) {
                    // Check if the error is version related
                    if (testResult.message.includes('version')) {
                        Alert.error(
                            `Unsupported ${formData.type} version. ${testResult.message}`
                        );
                    } else {
                        Alert.error(
                            `Connection test failed: ${testResult.message}`
                        );
                    }
                    setSaveConfirm(false);
                    return;
                }

                // If connection test passed, proceed with save/update
                if (editingArr) {
                    const result = await updateArrConfig(
                        editingArr.id,
                        formData
                    );
                    if (result.success) {
                        Alert.success('Configuration updated successfully');
                        onSubmit();
                    }
                } else {
                    const result = await saveArrConfig(formData);
                    if (result.success) {
                        Alert.success('Configuration saved successfully');
                        onSubmit();
                    }
                }
            } catch (error) {
                Alert.error('Failed to save configuration');
                console.error('Error saving configuration:', error);
            }
            setSaveConfirm(false);
        } else {
            setSaveConfirm(true);
            setTimeout(() => setSaveConfirm(false), 3000);
        }
    };

    const handleDelete = async () => {
        if (deleteConfirm) {
            try {
                const result = await deleteArrConfig(editingArr.id);
                if (result.success) {
                    Alert.success('Configuration deleted successfully');
                    onSubmit();
                }
            } catch (error) {
                Alert.error('Failed to delete configuration');
                console.error('Error deleting configuration:', error);
            }
            setDeleteConfirm(false);
        } else {
            setDeleteConfirm(true);
            setTimeout(() => setDeleteConfirm(false), 3000);
        }
    };

    const handleInputChange = e => {
        const {id, value} = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: value
        }));

        if (errors[id]) {
            setErrors(prev => ({
                ...prev,
                [id]: ''
            }));
        }
    };

    const handleAddTag = e => {
        e.preventDefault();
        if (tagInput.trim()) {
            if (!formData.tags.includes(tagInput.trim())) {
                setFormData(prev => ({
                    ...prev,
                    tags: [...prev.tags, tagInput.trim()]
                }));
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = tagToRemove => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.filter(tag => tag !== tagToRemove)
        }));
    };

    const handleTagInputKeyDown = e => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            handleAddTag(e);
        }
    };

    const inputClasses = errorKey => `
       w-full px-3 py-2 text-sm rounded-lg 
       border ${
           errors[errorKey]
               ? 'border-red-500'
               : 'border-gray-300 dark:border-gray-600'
       }
       bg-white dark:bg-gray-700 
       text-gray-900 dark:text-white
       focus:ring-2 ${
           errors[errorKey]
               ? 'focus:ring-red-500 focus:border-red-500'
               : 'focus:ring-blue-500 focus:border-blue-500'
       }
       placeholder-gray-400 dark:placeholder-gray-500
       transition-all
   `;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingArr ? 'Edit Arr' : 'Add New Arr'}
            width='2xl'>
            <form
                onSubmit={handleSubmit}
                className='space-y-4 overflow-visible'>
                <div className='space-y-1.5'>
                    <div className='flex items-center space-x-2'>
                        <Tooltip content='A unique name to identify this Arr instance'>
                            <label
                                htmlFor='name'
                                className='text-xs font-medium text-gray-700 dark:text-gray-300 cursor-help'>
                                Name
                            </label>
                        </Tooltip>
                    </div>
                    <input
                        id='name'
                        value={formData.name}
                        onChange={handleInputChange}
                        className={inputClasses('name')}
                        placeholder='My App Instance'
                        required
                    />
                </div>

                {/* Add Type Selection */}
                <div className='space-y-1.5'>
                    <div className='flex items-center space-x-2'>
                        <Tooltip content='Select the type of Arr instance'>
                            <label
                                htmlFor='type'
                                className='text-xs font-medium text-gray-700 dark:text-gray-300 cursor-help'>
                                Type
                            </label>
                        </Tooltip>
                    </div>
                    <select
                        id='type'
                        value={formData.type}
                        onChange={handleInputChange}
                        className={inputClasses('type')}
                        required>
                        {arrTypes.map(type => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Keep the rest of your existing form fields */}
                <div className='space-y-1.5'>
                    {/* Tags section */}
                    <div className='flex items-center space-x-2'>
                        <Tooltip content='Optional tags to categorize and filter your Arr instances'>
                            <label
                                htmlFor='tags'
                                className='text-xs font-medium text-gray-700 dark:text-gray-300 cursor-help flex items-center'>
                                Tags
                                <Tag size={12} className='ml-1 text-gray-400' />
                            </label>
                        </Tooltip>
                    </div>

                    <div className='flex flex-wrap gap-2 mb-2'>
                        {formData.tags.map((tag, index) => (
                            <span
                                key={index}
                                className='inline-flex items-center bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-xs rounded px-2 py-1'>
                                {tag}
                                <button
                                    type='button'
                                    onClick={() => handleRemoveTag(tag)}
                                    className='ml-1 hover:text-blue-900 dark:hover:text-blue-200'>
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>

                    <div className='flex gap-2'>
                        <input
                            id='tagInput'
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={handleTagInputKeyDown}
                            className={inputClasses('tagInput')}
                            placeholder='Enter tags...'
                        />
                        <button
                            type='button'
                            onClick={handleAddTag}
                            className='px-3 py-2 text-sm rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 
                               dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800
                               font-medium transition-colors'>
                            Add
                        </button>
                    </div>
                </div>

                {/* Rest of the fields */}
                <div className='space-y-1.5'>
                    <div className='flex items-center space-x-2'>
                        <Tooltip content='The URL of your Profilarr server as this app would see it.(e.g., http://localhost:7441)'>
                            <label
                                htmlFor='profilarrServer'
                                className='text-xs font-medium text-gray-700 dark:text-gray-300 cursor-help'>
                                Profilarr Server
                            </label>
                        </Tooltip>
                    </div>
                    <input
                        id='profilarrServer'
                        value={formData.profilarrServer}
                        onChange={handleInputChange}
                        className={inputClasses('profilarrServer')}
                        placeholder='http://localhost:7441'
                        required
                    />
                    {errors.profilarrServer && (
                        <p className='text-xs text-red-500 mt-1'>
                            {errors.profilarrServer}
                        </p>
                    )}
                </div>

                <div className='space-y-1.5'>
                    <div className='flex items-center space-x-2'>
                        <Tooltip content='The URL of this app as Profilarr would see it (e.g., http://localhost:7878 for Radarr)'>
                            <label
                                htmlFor='arrServer'
                                className='text-xs font-medium text-gray-700 dark:text-gray-300 cursor-help'>
                                Arr Server
                            </label>
                        </Tooltip>
                    </div>
                    <input
                        id='arrServer'
                        value={formData.arrServer}
                        onChange={handleInputChange}
                        className={inputClasses('arrServer')}
                        placeholder='http://localhost:7878'
                        required
                    />
                    {errors.arrServer && (
                        <p className='text-xs text-red-500 mt-1'>
                            {errors.arrServer}
                        </p>
                    )}
                </div>

                <div className='space-y-1.5'>
                    <div className='flex items-center space-x-2'>
                        <Tooltip content='Your Arr instance API key. Find this in Settings > General'>
                            <label
                                htmlFor='apiKey'
                                className='text-xs font-medium text-gray-700 dark:text-gray-300 cursor-help'>
                                API Key
                            </label>
                        </Tooltip>
                    </div>
                    <input
                        type='password'
                        id='apiKey'
                        value={formData.apiKey}
                        onChange={handleInputChange}
                        className={inputClasses('apiKey')}
                        placeholder='Enter your API key'
                        required
                    />
                </div>

                <div className='flex justify-end space-x-3 pt-4'>
                    {editingArr && (
                        <button
                            type='button'
                            onClick={handleDelete}
                            className='flex items-center px-3 py-2 text-sm rounded-lg
                               bg-red-600 hover:bg-red-700 
                               text-white font-medium transition-colors'>
                            {deleteConfirm ? (
                                <>
                                    <Check className='w-3.5 h-3.5 mr-2' />
                                    Confirm Delete
                                </>
                            ) : (
                                <>
                                    <Trash className='w-3.5 h-3.5 mr-2' />
                                    Delete
                                </>
                            )}
                        </button>
                    )}

                    <button
                        type='button'
                        onClick={handleTestConnection}
                        disabled={
                            isTestingConnection ||
                            !formData.arrServer ||
                            !formData.apiKey
                        }
                        className='flex items-center px-3 py-2 text-sm rounded-lg
                           bg-emerald-600 hover:bg-emerald-700 
                           disabled:opacity-50 disabled:cursor-not-allowed
                           text-white font-medium transition-colors'>
                        {isTestingConnection ? (
                            <>
                                <Loader className='w-3.5 h-3.5 mr-2 animate-spin' />
                                Testing...
                            </>
                        ) : testConfirm ? (
                            <>
                                <Check className='w-3.5 h-3.5 mr-2' />
                                Confirm Test
                            </>
                        ) : (
                            <>
                                <TestTube className='w-3.5 h-3.5 mr-2' />
                                Test Connection
                            </>
                        )}
                    </button>

                    <button
                        type='submit'
                        className='flex items-center px-3 py-2 text-sm rounded-lg
                           bg-blue-600 hover:bg-blue-700 
                           text-white font-medium transition-colors'>
                        {saveConfirm ? (
                            <>
                                <Check className='w-3.5 h-3.5 mr-2' />
                                Confirm {editingArr ? 'Update' : 'Add'}
                            </>
                        ) : editingArr ? (
                            <>
                                <Save className='w-3.5 h-3.5 mr-2' />
                                Update
                            </>
                        ) : (
                            <>
                                <Plus className='w-3.5 h-3.5 mr-2' />
                                Add
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ArrModal;
