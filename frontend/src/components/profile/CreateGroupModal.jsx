import React, {useState, useEffect} from 'react';
import Modal from '../ui/Modal';
import Tooltip from '@ui/Tooltip';
import {InfoIcon} from 'lucide-react';

const CreateGroupModal = ({
    isOpen,
    onClose,
    availableQualities,
    onCreateGroup,
    editingGroup = null
}) => {
    const [selectedQualities, setSelectedQualities] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen && editingGroup) {
            setGroupName(editingGroup.name);
            setDescription(editingGroup.description || '');

            // Set selected qualities from the editing group
            const existingQualities = editingGroup.qualities.map(quality => {
                // Find the quality in availableQualities to get the most up-to-date version
                return (
                    availableQualities.find(q => q.id === quality.id) || quality
                );
            });
            setSelectedQualities(existingQualities);
        } else if (!isOpen) {
            // Reset state when modal closes
            setGroupName('');
            setDescription('');
            setSelectedQualities([]);
        }
    }, [isOpen, editingGroup, availableQualities]);

    const getValidationMessage = () => {
        if (!groupName) return 'Please enter a group name';
        if (selectedQualities.length === 0)
            return 'Select at least one quality';
        return null;
    };

    const handleSave = () => {
        if (groupName && selectedQualities.length > 0) {
            const groupData = {
                // If editing, keep the same ID; otherwise generate new one
                id: editingGroup ? editingGroup.id : Date.now(),
                name: groupName,
                description,
                qualities: selectedQualities,
                // Preserve enabled state if editing, default to true for new groups
                enabled: editingGroup ? editingGroup.enabled : true,
                // Preserve radarr/sonarr settings if editing
                radarr: editingGroup?.radarr,
                sonarr: editingGroup?.sonarr
            };

            onCreateGroup(groupData);
        }
    };

    const isValid = groupName && selectedQualities.length > 0;

    const isQualitySelected = quality => {
        return selectedQualities.some(sq => sq.id === quality.id);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingGroup ? 'Edit Quality Group' : 'Create Quality Group'}
            width='xl'
            footer={
                <div className='flex justify-end'>
                    <Tooltip content={!isValid ? getValidationMessage() : null}>
                        <button
                            onClick={handleSave}
                            disabled={!isValid}
                            className='px-3 py-1.5 text-xs font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'>
                            {editingGroup ? 'Save Changes' : 'Save Group'}
                        </button>
                    </Tooltip>
                </div>
            }>
            <div className='space-y-4'>
                <div className='flex gap-2 p-3 text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg'>
                    <InfoIcon className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                    <p className='text-blue-700 dark:text-blue-300'>
                        Groups allow you to combine multiple qualities that are
                        considered equivalent. Items matching any quality in the
                        group will be treated equally.
                    </p>
                </div>

                <div>
                    <label className='block text-xs font-medium text-gray-700 dark:text-gray-200'>
                        Group Name
                    </label>
                    <input
                        type='text'
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        className='mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400'
                        placeholder='Enter group name'
                    />
                </div>

                <div>
                    <label className='block text-xs font-medium text-gray-700 dark:text-gray-200'>
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={2}
                        className='mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400'
                        placeholder='Optional description for this quality group'
                    />
                </div>

                <div>
                    <label className='block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2'>
                        Select Qualities
                    </label>
                    <div className='space-y-2 max-h-[400px] overflow-y-auto pr-2'>
                        {availableQualities
                            .filter(q => !('qualities' in q))
                            .map(quality => (
                                <div
                                    key={quality.id}
                                    onClick={() => {
                                        setSelectedQualities(prev =>
                                            isQualitySelected(quality)
                                                ? prev.filter(
                                                      q => q.id !== quality.id
                                                  )
                                                : [...prev, quality]
                                        );
                                    }}
                                    className={`
                                        cursor-pointer rounded-lg border p-2.5 transition-all
                                        ${
                                            isQualitySelected(quality)
                                                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }
                                    `}>
                                    <div className='flex-1'>
                                        <p className='text-xs font-medium text-gray-900 dark:text-gray-100'>
                                            {quality.name}
                                        </p>
                                        {quality.description && (
                                            <p className='mt-0.5 text-xs text-gray-500 dark:text-gray-400'>
                                                {quality.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default CreateGroupModal;
