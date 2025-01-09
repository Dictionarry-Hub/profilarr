import React, {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import ProfileCard from './ProfileCard';
import ProfileModal from './ProfileModal';
import {getGitStatus} from '@api/api';
import {Profiles, CustomFormats} from '@api/data';
import {Loader} from 'lucide-react';
import Alert from '@ui/Alert';
import {useMassSelection} from '@hooks/useMassSelection';
import {useKeyboardShortcut} from '@hooks/useKeyboardShortcut';
import MassActionsBar from '@ui/MassActionsBar';
import ImportModal from '@ui/ImportModal';
import {importProfiles} from '@api/import';
import DataBar from '@ui/DataBar/DataBar';

function ProfilePage() {
    const [profiles, setProfiles] = useState([]);
    const [formats, setFormats] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [sortBy, setSortBy] = useState('name');
    const [filterType, setFilterType] = useState('none');
    const [filterValue, setFilterValue] = useState('');
    const [allTags, setAllTags] = useState([]);
    const [isCloning, setIsCloning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [mergeConflicts, setMergeConflicts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [willBeSelected, setWillBeSelected] = useState([]);

    const navigate = useNavigate();

    // Mass selection hook
    const {
        selectedItems,
        isSelectionMode,
        toggleSelectionMode,
        handleSelect,
        clearSelection,
        lastSelectedIndex
    } = useMassSelection();

    // Setup keyboard shortcut for selection mode (Ctrl+A)
    useKeyboardShortcut('a', toggleSelectionMode, {ctrl: true});

    const loadingMessages = [
        'Profiling your media collection...',
        'Organizing your digital hoard...',
        'Calibrating the flux capacitor...',
        'Synchronizing with the movie matrix...',
        'Optimizing your binge-watching potential...'
    ];

    useEffect(() => {
        fetchGitStatus();
    }, []);

    // Add shift-key selection handling
    useEffect(() => {
        const handleKeyDown = e => {
            if (e.key === 'Shift' && lastSelectedIndex !== null) {
                const element = document.elementFromPoint(
                    window.mouseX,
                    window.mouseY
                );
                if (element) {
                    const card = element.closest('[data-profile-index]');
                    if (card) {
                        const index = parseInt(card.dataset.profileIndex);
                        handleMouseEnter(index, true);
                    }
                }
            }
        };

        const handleKeyUp = e => {
            if (e.key === 'Shift') {
                setWillBeSelected([]);
            }
        };

        const handleMouseMove = e => {
            window.mouseX = e.clientX;
            window.mouseY = e.clientY;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [lastSelectedIndex]);

    const fetchGitStatus = async () => {
        try {
            const result = await getGitStatus();
            if (result.success) {
                setMergeConflicts(result.data.merge_conflicts || []);
                if (result.data.merge_conflicts.length === 0) {
                    fetchProfiles();
                    fetchFormats();
                } else {
                    setIsLoading(false);
                }
            }
        } catch (error) {
            console.error('Error fetching Git status:', error);
            Alert.error('Failed to check repository status');
            setIsLoading(false);
        }
    };

    const fetchProfiles = async () => {
        try {
            const response = await Profiles.getAll();
            const profilesData = response.map(item => ({
                file_name: item.file_name,
                modified_date: item.modified_date,
                created_date: item.created_date,
                content: {
                    ...item.content,
                    name: item.file_name.replace('.yml', '')
                }
            }));
            setProfiles(profilesData);
            const tags = [
                ...new Set(
                    profilesData.flatMap(profile => profile.content.tags || [])
                )
            ];
            setAllTags(tags);
        } catch (error) {
            console.error('Error fetching profiles:', error);
            Alert.error('Failed to load profiles');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFormats = async () => {
        try {
            const response = await CustomFormats.getAll();
            const formatsData = response.map(item => ({
                id: item.content.name,
                name: item.content.name,
                description: item.content.description || '',
                tags: item.content.tags || []
            }));
            setFormats(formatsData);
        } catch (error) {
            console.error('Error fetching formats:', error);
            Alert.error('Failed to load formats');
        }
    };

    const handleOpenModal = (profile = null) => {
        if (isSelectionMode) return;
        const safeProfile = profile
            ? {
                  ...profile,
                  custom_formats: profile.custom_formats || []
              }
            : null;
        setSelectedProfile(safeProfile);
        setIsModalOpen(true);
        setIsCloning(false);
    };

    const handleCloseModal = () => {
        setSelectedProfile(null);
        setIsModalOpen(false);
        setIsCloning(false);
    };

    const handleCloneProfile = profile => {
        if (isSelectionMode) return;
        const clonedProfile = {
            ...profile,
            id: 0,
            name: `${profile.name} [COPY]`,
            custom_formats: profile.custom_formats || []
        };
        setSelectedProfile(clonedProfile);
        setIsModalOpen(true);
        setIsCloning(true);
    };

    const handleSaveProfile = () => {
        fetchProfiles();
        handleCloseModal();
    };

    const handleMassDelete = async () => {
        try {
            const selectedProfiles = Array.from(selectedItems).map(
                index => profiles[index]
            );
            for (const profile of selectedProfiles) {
                await Profiles.delete(profile.file_name.replace('.yml', ''));
            }
            Alert.success('Selected profiles deleted successfully');
            fetchProfiles();
            toggleSelectionMode();
        } catch (error) {
            console.error('Error deleting profiles:', error);
            Alert.error('Failed to delete selected profiles');
        }
    };

    const handleMassImport = async arr => {
        try {
            const selectedProfiles = Array.from(selectedItems).map(identifier =>
                profiles.find(p => p.content.name === identifier)
            );

            await importProfiles(
                arr,
                selectedProfiles.map(p => p.file_name)
            );
            Alert.success('Profiles imported successfully');
            toggleSelectionMode();
        } catch (error) {
            console.error('Error importing profiles:', error);
            Alert.error('Failed to import profiles');
            throw error;
        }
    };

    const handleProfileSelect = (profileName, index, e) => {
        if (e.shiftKey) {
            // Immediately show selection preview
            handleMouseEnter(index, true);
        }
        handleSelect(profileName, index, e, getFilteredAndSortedProfiles());
    };

    const handleMouseEnter = (index, isShiftKey) => {
        if (isShiftKey && lastSelectedIndex !== null) {
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);

            const potentialSelection = getFilteredAndSortedProfiles()
                .slice(start, end + 1)
                .map((profile, idx) => idx + start);

            setWillBeSelected(potentialSelection);
        }
    };

    const getFilteredAndSortedProfiles = () => {
        return profiles
            .filter(profile => {
                // Apply search filter
                if (searchQuery) {
                    return (
                        profile.content.name
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()) ||
                        profile.content.tags?.some(tag =>
                            tag
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase())
                        )
                    );
                }

                // Apply existing filters
                if (filterType === 'tag') {
                    return (
                        profile.content.tags &&
                        profile.content.tags.includes(filterValue)
                    );
                }
                if (filterType === 'date') {
                    const profileDate = new Date(profile.modified_date);
                    const filterDate = new Date(filterValue);
                    return (
                        profileDate.toDateString() === filterDate.toDateString()
                    );
                }
                return true;
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'dateModified':
                        return (
                            new Date(b.modified_date) -
                            new Date(a.modified_date)
                        );
                    case 'dateCreated':
                        return (
                            new Date(b.created_date) - new Date(a.created_date)
                        );
                    case 'name':
                    default:
                        return a.content.name.localeCompare(b.content.name);
                }
            });
    };

    const formatDate = dateString => {
        return new Date(dateString).toLocaleString();
    };

    if (isLoading) {
        return (
            <div className='flex flex-col items-center justify-center h-screen'>
                <Loader size={48} className='animate-spin text-blue-500 mb-4' />
                <p className='text-lg font-medium text-gray-700 dark:text-gray-300'>
                    {
                        loadingMessages[
                            Math.floor(Math.random() * loadingMessages.length)
                        ]
                    }
                </p>
            </div>
        );
    }

    const hasConflicts = mergeConflicts.length > 0;

    if (hasConflicts) {
        return (
            <div className='bg-gray-900 text-white'>
                <div className='mt-8 flex justify-between items-center'>
                    <h4 className='text-xl font-extrabold'>
                        Merge Conflicts Detected
                    </h4>
                    <button
                        onClick={() => navigate('/settings')}
                        className='bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition'>
                        Resolve Conflicts
                    </button>
                </div>

                <div className='mt-6 p-4 bg-gray-800 rounded-lg shadow-md'>
                    <h3 className='text-xl font-semibold'>What Happened?</h3>
                    <p className='mt-2 text-gray-300'>
                        This page is locked because there are unresolved merge
                        conflicts. You need to address these conflicts in the
                        settings page before continuing.
                    </p>
                </div>
            </div>
        );
    }

    const filteredProfiles = getFilteredAndSortedProfiles();

    return (
        <div>
            <DataBar
                onSearch={setSearchQuery}
                searchPlaceholder='Search by name or tag...'
                filterType={filterType}
                setFilterType={setFilterType}
                filterValue={filterValue}
                setFilterValue={setFilterValue}
                allTags={allTags}
                sortBy={sortBy}
                setSortBy={setSortBy}
                isSelectionMode={isSelectionMode}
                toggleSelectionMode={toggleSelectionMode}
                onAdd={() => handleOpenModal()}
                addButtonLabel='Add New Profile'
            />

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 h-full'>
                {filteredProfiles.map((profile, index) => (
                    <div
                        key={profile.file_name}
                        data-profile-index={index}
                        className='h-full'
                        onMouseEnter={() =>
                            handleMouseEnter(index, window.event?.shiftKey)
                        }
                        onMouseLeave={() => setWillBeSelected([])}>
                        <ProfileCard
                            profile={profile}
                            onEdit={() => handleOpenModal(profile)}
                            onClone={handleCloneProfile}
                            formatDate={formatDate}
                            sortBy={sortBy}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedItems.has(index)}
                            willBeSelected={willBeSelected.includes(index)}
                            onSelect={e =>
                                handleProfileSelect(
                                    profile.content.name,
                                    index,
                                    e
                                )
                            }
                        />
                    </div>
                ))}
            </div>

            {isSelectionMode && (
                <MassActionsBar
                    selectedCount={selectedItems.size}
                    onCancel={toggleSelectionMode}
                    onDelete={handleMassDelete}
                    onImport={() => setIsImportModalOpen(true)}
                />
            )}

            <ProfileModal
                profile={selectedProfile}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveProfile}
                formats={formats}
                isCloning={isCloning}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleMassImport}
                type='Profiles'
            />
        </div>
    );
}

export default ProfilePage;
