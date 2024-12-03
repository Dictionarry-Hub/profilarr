import React from 'react';
import PropTypes from 'prop-types';
import Modal from '@ui/Modal';
import FormatGeneralTab from './FormatGeneralTab';
import FormatConditionsTab from './FormatConditionsTab';
import FormatTestingTab from './FormatTestingTab';
import Alert from '@ui/Alert';
import {Loader} from 'lucide-react';

const FormatModal = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    isCloning,
    name,
    description,
    tags,
    conditions,
    tests,
    error,
    activeTab,
    isDeleting,
    isRunningTests,
    onNameChange,
    onDescriptionChange,
    onTagsChange,
    onConditionsChange,
    onTestsChange,
    onActiveTabChange,
    onDeletingChange,
    onRunTests
}) => {
    const tabs = [
        {id: 'general', label: 'General'},
        {id: 'conditions', label: 'Conditions'},
        {id: 'testing', label: 'Testing'}
    ];

    const handleDelete = async () => {
        if (isDeleting) {
            try {
                await onDelete();
                onClose();
            } catch (error) {
                console.error('Error deleting format:', error);
                Alert.error('Failed to delete format. Please try again.');
            }
        } else {
            onDeletingChange(true);
        }
    };

    const modalTitle = isCloning
        ? 'Clone Format'
        : name
        ? 'Edit Format'
        : 'Add Format';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            height='6xl'
            width='6xl'
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onActiveTabChange}
            footer={
                <div className='flex justify-between'>
                    {name && !isCloning && (
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
                                onClick={() => onRunTests(conditions, tests)}
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
                            onClick={onSave}
                            className='bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors'>
                            Save
                        </button>
                    </div>
                </div>
            }>
            {activeTab => (
                <div className='h-full'>
                    {activeTab === 'general' && (
                        <FormatGeneralTab
                            name={name}
                            description={description}
                            tags={tags}
                            error={error}
                            onNameChange={onNameChange}
                            onDescriptionChange={onDescriptionChange}
                            onAddTag={tag => onTagsChange([...tags, tag])}
                            onRemoveTag={tag =>
                                onTagsChange(tags.filter(t => t !== tag))
                            }
                        />
                    )}
                    {activeTab === 'conditions' && (
                        <FormatConditionsTab
                            conditions={conditions}
                            onConditionsChange={onConditionsChange}
                        />
                    )}
                    {activeTab === 'testing' && (
                        <FormatTestingTab
                            conditions={conditions}
                            tests={tests}
                            onTestsChange={onTestsChange}
                            isRunningTests={isRunningTests}
                            onRunTests={onRunTests}
                        />
                    )}
                </div>
            )}
        </Modal>
    );
};

FormatModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    isCloning: PropTypes.bool,
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    tags: PropTypes.arrayOf(PropTypes.string).isRequired,
    conditions: PropTypes.arrayOf(PropTypes.object).isRequired,
    tests: PropTypes.arrayOf(PropTypes.object).isRequired,
    error: PropTypes.string,
    activeTab: PropTypes.string.isRequired,
    isDeleting: PropTypes.bool.isRequired,
    isRunningTests: PropTypes.bool.isRequired,
    onNameChange: PropTypes.func.isRequired,
    onDescriptionChange: PropTypes.func.isRequired,
    onTagsChange: PropTypes.func.isRequired,
    onConditionsChange: PropTypes.func.isRequired,
    onTestsChange: PropTypes.func.isRequired,
    onActiveTabChange: PropTypes.func.isRequired,
    onDeletingChange: PropTypes.func.isRequired,
    onRunTests: PropTypes.func.isRequired
};

export default FormatModal;
