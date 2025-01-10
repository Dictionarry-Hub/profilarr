import React, {useEffect} from 'react';
import PropTypes from 'prop-types';
import Modal from '@ui/Modal';
import RegexGeneralTab from './RegexGeneralTab';
import RegexTestingTab from './RegexTestingTab';
import {useRegexModal} from '@hooks/useRegexModal';
import {RegexPatterns} from '@api/data';
import Alert from '@ui/Alert';
import {Loader, Play} from 'lucide-react';

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
                    className={`px-4 py-2 text-white rounded transition-colors ${
                        isDeleting
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-red-500 hover:bg-red-600'
                    }`}>
                    {isDeleting ? 'Confirm Delete' : 'Delete'}
                </button>
            )}
            <div className='flex gap-2'>
                {activeTab === 'testing' && tests?.length > 0 && (
                    <button
                        onClick={() => handleRunTests(patternValue, tests)}
                        disabled={isRunningTests}
                        className='inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 
                        disabled:bg-green-600/50 text-white rounded transition-colors'>
                        {isRunningTests ? (
                            <Loader className='w-4 h-4 mr-2 animate-spin' />
                        ) : (
                            <Play className='w-4 h-4 mr-2' />
                        )}
                        Run Tests
                    </button>
                )}
                <button
                    onClick={handleSave}
                    className='bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors'>
                    Save
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
