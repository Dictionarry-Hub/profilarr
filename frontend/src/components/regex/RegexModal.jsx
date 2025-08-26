import React, {useEffect} from 'react';
import PropTypes from 'prop-types';
import Modal from '@ui/Modal';
import RegexGeneralTab from './RegexGeneralTab';
import RegexTestingTab from './RegexTestingTab';
import {useRegexModal} from '@hooks/useRegexModal';
import {RegexPatterns} from '@api/data';
import Alert from '@ui/Alert';
import {Loader, Play, Save, Trash2, Check} from 'lucide-react';

const RegexModal = ({
    pattern: initialPattern,
    isOpen,
    onClose,
    onSave,
    isCloning = false
}) => {
    const {
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
    } = useRegexModal(initialPattern, onSave);

    const tabs = [
        {id: 'general', label: 'General'},
        {id: 'testing', label: 'Testing'}
    ];

    useEffect(() => {
        if (isOpen) {
            initializeForm(initialPattern, isCloning);
        }
    }, [initialPattern, isOpen, isCloning, initializeForm]);

    const handleDelete = async () => {
        if (!initialPattern) return;
        if (isDeleting) {
            try {
                await RegexPatterns.delete(
                    initialPattern.file_name.replace('.yml', '')
                );
                onSave();
                onClose();
            } catch (error) {
                console.error('Error deleting pattern:', error);
                Alert.error(
                    error.response?.data?.error ||
                        'Failed to delete pattern. Please try again.'
                );
            } finally {
                setIsDeleting(false);
            }
        } else {
            setIsDeleting(true);
        }
    };

    const footerContent = (
        <div className='flex justify-between'>
            {initialPattern && !isCloning && (
                <button
                    onClick={handleDelete}
                    className='inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors'>
                    {isDeleting ? (
                        <Check className="w-4 h-4 text-green-500" />
                    ) : (
                        <Trash2 className="w-4 h-4 text-red-500" />
                    )}
                    <span>Delete</span>
                </button>
            )}
            <div className='flex gap-2'>
                {activeTab === 'testing' && tests?.length > 0 && (
                    <button
                        onClick={() => handleRunTests(patternValue, tests)}
                        disabled={isRunningTests}
                        className='inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 disabled:opacity-50 transition-colors'>
                        {isRunningTests ? (
                            <Loader className="w-4 h-4 text-yellow-500 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4 text-green-500" />
                        )}
                        <span>Run Tests</span>
                    </button>
                )}
                <button
                    onClick={handleSave}
                    className='inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors'>
                    <Save className="w-4 h-4 text-blue-500" />
                    <span>Save</span>
                </button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                isCloning
                    ? 'Clone Pattern'
                    : initialPattern
                    ? 'Edit Pattern'
                    : 'Add Pattern'
            }
            height='6xl'
            width='4xl'
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            footer={footerContent}>
            {activeTab => {
                return (
                    <div className='h-full'>
                        {activeTab === 'general' && (
                            <RegexGeneralTab
                                name={name}
                                description={description}
                                pattern={patternValue}
                                error={error}
                                patternError={patternError}
                                tags={tags}
                                onNameChange={setName}
                                onDescriptionChange={setDescription}
                                onPatternChange={newPattern => {
                                    setPatternValue(newPattern);
                                    setPatternError('');
                                }}
                                onAddTag={tag => setTags([...tags, tag])}
                                onRemoveTag={tag =>
                                    setTags(tags.filter(t => t !== tag))
                                }
                            />
                        )}
                        {activeTab === 'testing' && (
                            <RegexTestingTab
                                pattern={patternValue}
                                tests={tests || []}
                                onTestsChange={setTests}
                                isRunningTests={isRunningTests}
                                onRunTests={handleRunTests}
                            />
                        )}
                    </div>
                );
            }}
        </Modal>
    );
};

RegexModal.propTypes = {
    pattern: PropTypes.shape({
        name: PropTypes.string.isRequired,
        pattern: PropTypes.string.isRequired,
        description: PropTypes.string,
        tags: PropTypes.arrayOf(PropTypes.string),
        tests: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.number.isRequired,
                input: PropTypes.string.isRequired,
                expected: PropTypes.bool.isRequired,
                passes: PropTypes.bool.isRequired,
                lastRun: PropTypes.string
            })
        ),
        created_date: PropTypes.string,
        modified_date: PropTypes.string
    }),
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    isCloning: PropTypes.bool
};

export default RegexModal;
