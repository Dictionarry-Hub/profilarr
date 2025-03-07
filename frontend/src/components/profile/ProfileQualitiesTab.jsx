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
import {InfoIcon, ArrowUp} from 'lucide-react';
import Modal from '../ui/Modal';
import CreateGroupModal from './CreateGroupModal';
import QualityItem from './quality/QualityItem';
import QUALITIES from '../../constants/qualities';
import Alert from '@ui/Alert';
import Tooltip from '@ui/Tooltip';

const SortableItem = ({
    quality, 
    onToggle, 
    onDelete, 
    onEdit,
    isUpgradeUntil,
    onUpgradeUntilClick
}) => {
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
                isUpgradeUntil={isUpgradeUntil}
                onUpgradeUntilClick={quality.enabled ? onUpgradeUntilClick : undefined}
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
            // Prevent disabling a quality that's set as the upgrade until quality
            if (quality.enabled && upgradesAllowed && selectedUpgradeQuality && isUpgradeUntilQuality(quality)) {
                Alert.error("You can't disable a quality that's set as 'upgrade until'. Please set another quality as 'upgrade until' first.");
                return;
            }
            
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

            // We shouldn't reach this point for the upgrade until quality,
            // but keeping as a safety measure
            if (
                upgradesAllowed &&
                selectedUpgradeQuality &&
                quality.enabled === false && // We're disabling a quality
                (quality.id === selectedUpgradeQuality.id || // Direct match (group or quality)
                    ('qualities' in quality && // Quality is in a group that's being disabled
                        !('qualities' in selectedUpgradeQuality) && 
                        quality.qualities.some(q => q.id === selectedUpgradeQuality.id)))
            ) {
                // Find another enabled quality to set as upgrade until
                const nearestQuality = findNearestEnabledQuality(
                    newQualities,
                    quality.id
                );
                
                if (nearestQuality) {
                    onSelectedUpgradeQualityChange?.(nearestQuality);
                    Alert.info(`Upgrade until quality changed to ${nearestQuality.name}`);
                }
            }
        }
    };

    const handleUpgradeUntilClick = quality => {
        // Make sure we're setting the quality object properly
        if (quality) {
            // For single qualities, pass as is
            // For groups, we pass the group itself to maintain the group ID in the selection
            onSelectedUpgradeQualityChange?.(quality);
            
            // Provide user feedback
            Alert.success(`${quality.name} set as upgrade until quality`);
        }
    };

    const handleCreateOrUpdateGroup = groupData => {
        // Check if the currently selected upgrade quality is being moved into this group
        if (selectedUpgradeQuality) {
            // If the selected upgrade quality is a single quality (not a group itself)
            if (!('qualities' in selectedUpgradeQuality)) {
                const qualityMovingToGroup = groupData.qualities.some(
                    q => q.id === selectedUpgradeQuality.id
                );
                
                // If the current upgrade quality is being moved into this group
                // Update the upgrade quality to be the group instead
                if (qualityMovingToGroup) {
                    onSelectedUpgradeQualityChange({
                        id: groupData.id,
                        name: groupData.name,
                        description: groupData.description
                    });
                }
            } 
            // If the selected upgrade quality is the group we're editing
            else if (selectedUpgradeQuality.id === editingGroup?.id) {
                // Update the upgrade quality to reflect the new group data
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
            // Find the first quality from the group and set it as the upgrade until quality
            if (group.qualities && group.qualities.length > 0) {
                const firstQualityFromGroup = group.qualities[0];
                onSelectedUpgradeQualityChange(firstQualityFromGroup);
                Alert.info(`Upgrade until quality changed to ${firstQualityFromGroup.name}`);
            } else {
                // If somehow the group has no qualities, find the first enabled quality
                const firstEnabledQuality = sortedQualities.find(q => q.enabled && q.id !== group.id);
                if (firstEnabledQuality) {
                    onSelectedUpgradeQualityChange(firstEnabledQuality);
                    Alert.info(`Upgrade until quality changed to ${firstEnabledQuality.name}`);
                }
            }
        }

        onSortedQualitiesChange(prev => {
            const index = prev.findIndex(q => q.id === group.id);
            if (index === -1) return prev;
            const newQualities = [...prev];
            
            // Make sure all qualities from the group are set as enabled
            const enabledGroupQualities = group.qualities.map(q => ({
                ...q,
                enabled: true
            }));
            
            newQualities.splice(index, 1, ...enabledGroupQualities);
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

    const isUpgradeUntilQuality = (quality) => {
        if (!selectedUpgradeQuality) return false;
        
        // Direct ID match (works for both individual qualities and groups)
        if (quality.id === selectedUpgradeQuality.id) {
            return true;
        }
        
        // Check if the selected upgrade quality is a member of this group
        if ('qualities' in quality && 
            !('qualities' in selectedUpgradeQuality) && 
            quality.qualities.some(q => q.id === selectedUpgradeQuality.id)) {
            return true;
        }
        
        return false;
    };

    return (
        <div className='h-full flex flex-col'>
            <div className='pb-4 pr-4'>
                <div className='grid grid-cols-[auto_1fr_auto] gap-4 items-center'>
                    <h2 className='text-xl font-semibold text-gray-900 dark:text-gray-100 leading-tight'>
                        Quality Rankings
                    </h2>

                    <div className='flex items-center'>
                        <p className='text-xs text-gray-600 dark:text-gray-400 leading-relaxed'>
                            Qualities higher in the list are more preferred even if
                            not checked. Qualities within the same group are equal.
                            Only checked qualities are wanted.
                        </p>

                        {/* Only show upgrade hint if upgrades are allowed */}
                    </div>

                    <button
                        onClick={() => setIsCreateGroupModalOpen(true)}
                        className='h-10 px-6 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-2'>
                        <InfoIcon className='w-4 h-4' />
                        Create Group
                    </button>
                </div>
            </div>

            <div className='flex-1 overflow-auto scrollable pr-4'>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    modifiers={[
                        restrictToVerticalAxis,
                        restrictToParentElement
                    ]}>
                    <div className='py-4'>
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
                                        isUpgradeUntil={isUpgradeUntilQuality(quality)}
                                        onUpgradeUntilClick={upgradesAllowed ? handleUpgradeUntilClick : undefined}
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
