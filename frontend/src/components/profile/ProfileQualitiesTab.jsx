import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {
    restrictToVerticalAxis,
    restrictToParentElement
} from '@dnd-kit/modifiers';
import {InfoIcon} from 'lucide-react';
import Modal from '../ui/Modal';
import CreateGroupModal from './CreateGroupModal';
import QualityItem from './quality/QualityItem';
import QUALITIES from '../../constants/qualities';
import Alert from '@ui/Alert';

const UpgradeSection = ({
    enabledQualities,
    selectedUpgradeQuality,
    onUpgradeQualityChange
}) => {
    if (enabledQualities.length === 0) {
        return null;
    }

    return (
        <div className='bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-4'>
            <div className='grid grid-cols-[auto_1fr_auto] gap-4 items-center'>
                <h3 className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                    Upgrade Until
                </h3>
                <p className='text-xs text-gray-600 dark:text-gray-400'>
                    Downloads will be upgraded until this quality is reached.
                    Lower qualities will be upgraded, while higher qualities
                    will be left unchanged.
                </p>
                <select
                    className='w-48 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm'
                    value={selectedUpgradeQuality?.id || ''}
                    onChange={e => {
                        const quality = enabledQualities.find(
                            q => q.id === parseInt(e.target.value)
                        );
                        onUpgradeQualityChange(quality);
                    }}>
                    {enabledQualities.map(quality => (
                        <option key={quality.id} value={quality.id}>
                            {quality.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

const SortableItem = ({quality, onToggle, onDelete, onEdit}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: quality.id
    });

    const style = {
        transform: transform
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : undefined,
        transition
    };

    return (
        <div
            ref={setNodeRef}
            onClick={() => onToggle(quality)}
            data-group-id={quality.id}>
            <QualityItem
                quality={quality}
                isDragging={isDragging}
                listeners={listeners}
                attributes={attributes}
                style={style}
                onEdit={'qualities' in quality ? onEdit : undefined}
                onDelete={'qualities' in quality ? onDelete : undefined}
            />
        </div>
    );
};

const ProfileQualitiesTab = ({
    enabledQualities,
    onQualitiesChange,
    upgradesAllowed,
    selectedUpgradeQuality,
    onSelectedUpgradeQualityChange,
    sortedQualities,
    onSortedQualitiesChange
}) => {
    const [activeId, setActiveId] = useState(null);
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState(null);
    const [editingGroup, setEditingGroup] = useState(null);

    useEffect(() => {
        if (!isInitialLoad) {
            const needsUpdate = sortedQualities.some(quality => {
                if ('qualities' in quality) {
                    const isEnabled = enabledQualities.some(eq =>
                        quality.qualities.some(gq => gq.id === eq.id)
                    );
                    return quality.enabled !== isEnabled;
                }
                const isEnabled = enabledQualities.some(
                    q => q.id === quality.id
                );
                return quality.enabled !== isEnabled;
            });

            if (needsUpdate) {
                onSortedQualitiesChange(prev =>
                    prev.map(quality => {
                        if ('qualities' in quality) {
                            return {
                                ...quality,
                                enabled: enabledQualities.some(eq =>
                                    quality.qualities.some(
                                        gq => gq.id === eq.id
                                    )
                                )
                            };
                        }
                        return {
                            ...quality,
                            enabled: enabledQualities.some(
                                q => q.id === quality.id
                            )
                        };
                    })
                );
            }
            return;
        }

        if (enabledQualities.length === 0) {
            const defaultQuality = sortedQualities.find(q => q.id === 10);
            if (defaultQuality) {
                onSortedQualitiesChange(prev =>
                    prev.map(q => (q.id === 10 ? {...q, enabled: true} : q))
                );
                onQualitiesChange([defaultQuality]);
                onSelectedUpgradeQualityChange?.(defaultQuality);
                if (!isInitialLoad) {
                    Alert.info(
                        'Bluray-1080p has been automatically selected as the default quality.'
                    );
                }
            }
        }

        setIsInitialLoad(false);
    }, [
        enabledQualities,
        onQualitiesChange,
        onSelectedUpgradeQualityChange,
        isInitialLoad,
        sortedQualities,
        onSortedQualitiesChange
    ]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8
            }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const findNearestEnabledQuality = (qualities, currentQualityId) => {
        const currentIndex = qualities.findIndex(
            q => q.id === currentQualityId
        );

        // Try to find the next enabled quality below
        for (let i = currentIndex + 1; i < qualities.length; i++) {
            if (qualities[i].enabled) return qualities[i];
        }

        // If not found, try to find the nearest enabled quality above
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (qualities[i].enabled) return qualities[i];
        }

        return null;
    };

    const handleQualityToggle = quality => {
        if (!activeId) {
            const currentEnabledCount = sortedQualities.filter(
                q => q.enabled
            ).length;

            if (quality.enabled && currentEnabledCount <= 1) {
                Alert.error('At least one quality must be selected.');
                return;
            }

            const newQualities = sortedQualities.map(q => {
                if (q.id === quality.id) {
                    return {
                        ...q,
                        enabled: !q.enabled
                    };
                }
                return q;
            });

            onSortedQualitiesChange(newQualities);

            // Update enabledQualities
            const allEnabledQualities = [];
            newQualities.forEach(q => {
                if (q.enabled) {
                    if ('qualities' in q) {
                        allEnabledQualities.push(...q.qualities);
                    } else {
                        allEnabledQualities.push(q);
                    }
                }
            });

            onQualitiesChange(allEnabledQualities);

            // Only update the upgrade quality if we're disabling the current upgrade quality
            if (
                selectedUpgradeQuality &&
                quality.enabled === false && // We're disabling a quality
                (quality.id === selectedUpgradeQuality.id || // Direct match
                    ('qualities' in quality && // Group match
                        quality.qualities.some(
                            q => q.id === selectedUpgradeQuality.id
                        )))
            ) {
                const nearestQuality = findNearestEnabledQuality(
                    newQualities,
                    quality.id
                );
                onSelectedUpgradeQualityChange?.(nearestQuality);
            }
        }
    };

    const handleCreateOrUpdateGroup = groupData => {
        if (
            selectedUpgradeQuality &&
            !('qualities' in selectedUpgradeQuality)
        ) {
            const qualityMovingToGroup = groupData.qualities.some(
                q => q.id === selectedUpgradeQuality.id
            );
            if (qualityMovingToGroup) {
                onSelectedUpgradeQualityChange({
                    id: groupData.id,
                    name: groupData.name,
                    description: groupData.description
                });
            }
        }

        onSortedQualitiesChange(prev => {
            // Remove the old group if we're editing
            let qualities = prev.filter(q => q.id !== editingGroup?.id);
            // Remove individual qualities that are now part of the group
            qualities = qualities.filter(
                q =>
                    !groupData.qualities.find(
                        selectedQ => selectedQ.id === q.id
                    )
            );
            const newGroup = {
                ...groupData,
                description: groupData.description || '',
                enabled: true
            };
            const newQualities = [newGroup, ...qualities];

            return newQualities;
        });

        const allEnabledQualities = [];
        sortedQualities.forEach(q => {
            if (q.enabled) {
                if ('qualities' in q) {
                    allEnabledQualities.push(...q.qualities);
                } else {
                    allEnabledQualities.push(q);
                }
            }
        });

        onQualitiesChange(allEnabledQualities);
        setEditingGroup(null);
        setIsCreateGroupModalOpen(false);
    };

    const handleEditClick = group => {
        const groupQualities = group.qualities || [];
        const otherQualities = sortedQualities.filter(q => {
            if (!('qualities' in q)) return true;
            return q.id !== group.id;
        });

        // Create a map of qualities that are available for selection
        const availableQualities = QUALITIES.map(originalQuality => {
            // If this quality is in the current group, use it
            const groupQuality = groupQualities.find(
                gq => gq.id === originalQuality.id
            );
            if (groupQuality) return groupQuality;

            // If this quality is not in another group, make it available
            const isInOtherGroup = otherQualities.some(
                q =>
                    'qualities' in q &&
                    q.qualities.some(gq => gq.id === originalQuality.id)
            );

            if (!isInOtherGroup) {
                return (
                    otherQualities.find(q => q.id === originalQuality.id) ||
                    originalQuality
                );
            }
            return null;
        }).filter(Boolean);

        setEditingGroup({
            ...group,
            availableQualities,
            description: group.description || ''
        });
        setIsCreateGroupModalOpen(true);
    };

    const handleDeleteClick = group => {
        setGroupToDelete(group);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteGroup = group => {
        // Check if we're deleting the currently selected upgrade group
        if (selectedUpgradeQuality && selectedUpgradeQuality.id === group.id) {
            const firstQualityFromGroup = group.qualities[0];
            onSelectedUpgradeQualityChange(firstQualityFromGroup);
        }

        onSortedQualitiesChange(prev => {
            const index = prev.findIndex(q => q.id === group.id);
            if (index === -1) return prev;
            const newQualities = [...prev];
            newQualities.splice(index, 1, ...group.qualities);
            return newQualities;
        });
    };

    const handleConfirmDelete = () => {
        if (groupToDelete) {
            handleDeleteGroup(groupToDelete);
            setIsDeleteModalOpen(false);
            setGroupToDelete(null);
        }
    };

    const handleDragStart = event => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = event => {
        const {active, over} = event;

        if (over && active.id !== over.id) {
            onSortedQualitiesChange(qualities => {
                const oldIndex = qualities.findIndex(q => q.id === active.id);
                const newIndex = qualities.findIndex(q => q.id === over.id);
                return arrayMove(qualities, oldIndex, newIndex);
            });
        }

        setActiveId(null);
    };

    return (
        <div className='h-full flex flex-col'>
            <div className='bg-white dark:bg-gray-800 pb-4'>
                <div className='grid grid-cols-[auto_1fr_auto] gap-4 items-center'>
                    <h2 className='text-xl font-semibold text-gray-900 dark:text-gray-100 leading-tight'>
                        Quality Rankings
                    </h2>

                    <p className='text-xs text-gray-600 dark:text-gray-400 leading-relaxed'>
                        Qualities higher in the list are more preferred even if
                        not checked. Qualities within the same group are equal.
                        Only checked qualities are wanted.
                    </p>

                    <button
                        onClick={() => setIsCreateGroupModalOpen(true)}
                        className='h-10 px-6 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-2'>
                        <InfoIcon className='w-4 h-4' />
                        Create Group
                    </button>
                </div>
            </div>

            {upgradesAllowed && (
                <UpgradeSection
                    enabledQualities={sortedQualities.filter(q => q.enabled)}
                    selectedUpgradeQuality={selectedUpgradeQuality}
                    onUpgradeQualityChange={onSelectedUpgradeQualityChange}
                />
            )}

            <div className='flex-1 overflow-auto'>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    modifiers={[
                        restrictToVerticalAxis,
                        restrictToParentElement
                    ]}>
                    <div className=''>
                        <div className='space-y-2'>
                            <SortableContext
                                items={sortedQualities.map(q => q.id)}
                                strategy={verticalListSortingStrategy}>
                                {sortedQualities.map(quality => (
                                    <SortableItem
                                        key={quality.id}
                                        quality={quality}
                                        onToggle={handleQualityToggle}
                                        onDelete={
                                            'qualities' in quality
                                                ? handleDeleteClick
                                                : undefined
                                        }
                                        onEdit={
                                            'qualities' in quality
                                                ? handleEditClick
                                                : undefined
                                        }
                                    />
                                ))}
                            </SortableContext>
                        </div>
                    </div>
                </DndContext>
            </div>

            <CreateGroupModal
                isOpen={isCreateGroupModalOpen}
                onClose={() => {
                    setIsCreateGroupModalOpen(false);
                    setEditingGroup(null);
                }}
                availableQualities={
                    editingGroup?.availableQualities || sortedQualities
                }
                onCreateGroup={handleCreateOrUpdateGroup}
                editingGroup={editingGroup}
            />

            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setGroupToDelete(null);
                }}
                title='Delete Quality Group'
                width='md'
                footer={
                    <div className='flex justify-end space-x-3'>
                        <button
                            onClick={() => {
                                setIsDeleteModalOpen(false);
                                setGroupToDelete(null);
                            }}
                            className='px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700'>
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmDelete}
                            className='px-3 py-1.5 text-xs font-medium text-white bg-red-600 dark:bg-red-500 rounded-md hover:bg-red-700 dark:hover:bg-red-600'>
                            Delete
                        </button>
                    </div>
                }>
                <p className='text-sm text-gray-600 dark:text-gray-300'>
                    Are you sure you want to delete the quality group "
                    {groupToDelete?.name}"? This action cannot be undone.
                </p>
            </Modal>
        </div>
    );
};

ProfileQualitiesTab.propTypes = {
    enabledQualities: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            name: PropTypes.string.isRequired,
            description: PropTypes.string
        })
    ).isRequired,
    onQualitiesChange: PropTypes.func.isRequired,
    upgradesAllowed: PropTypes.bool,
    selectedUpgradeQuality: PropTypes.shape({
        id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
        description: PropTypes.string
    }),
    onSelectedUpgradeQualityChange: PropTypes.func,
    sortedQualities: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            name: PropTypes.string.isRequired,
            description: PropTypes.string,
            enabled: PropTypes.bool,
            qualities: PropTypes.arrayOf(
                PropTypes.shape({
                    id: PropTypes.number.isRequired,
                    name: PropTypes.string.isRequired,
                    description: PropTypes.string
                })
            )
        })
    ).isRequired,
    onSortedQualitiesChange: PropTypes.func.isRequired
};

export default ProfileQualitiesTab;
