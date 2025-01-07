import React, {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import ProfileCard from './ProfileCard';
import ProfileModal from './ProfileModal';
import AddButton from '@ui/AddButton';
import {getGitStatus} from '@api/api';
import {Profiles, CustomFormats} from '@api/data';
import FilterMenu from '@ui/FilterMenu';
import SortMenu from '@ui/SortMenu';
import {Loader, CheckSquare} from 'lucide-react';
import SearchBar from '@ui/SearchBar';
import {useMassSelection} from '@hooks/useMassSelection';
import {useKeyboardShortcut} from '@hooks/useKeyboardShortcut';
import MassActionsBar from '@ui/MassActionsBar';
import ImportModal from '@ui/ImportModal';
import {importProfiles} from '@api/import';
import Alert from '@ui/Alert';

function ProfilePage() {
    const [profiles, setProfiles] = useState([]);
    const [formats, setFormats] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [sortBy, setSortBy] = useState('title');
    const [filterType, setFilterType] = useState('none');
    const [filterValue, setFilterValue] = useState('');
    const [allTags, setAllTags] = useState([]);
    const [isCloning, setIsCloning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [mergeConflicts, setMergeConflicts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const navigate = useNavigate();

    // Mass selection state
    const {
        selectedItems,
        isSelectionMode,
        toggleSelectionMode,
        handleSelect,
        clearSelection
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
                id: item.content.name, // Use name as ID
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
            // Use the identifier to find the correct profile
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

    const formatDate = dateString => {
        return new Date(dateString).toLocaleString();
    };

    const sortedAndFilteredProfiles = profiles
        .filter(profile => {
            // Apply search filter
            if (searchQuery) {
                return (
                    profile.content.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    profile.content.tags?.some(tag =>
                        tag.toLowerCase().includes(searchQuery.toLowerCase())
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
                return profileDate.toDateString() === filterDate.toDateString();
            }
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'name')
                return a.content.name.localeCompare(b.content.name);
            if (sortBy === 'dateCreated')
                return new Date(b.created_date) - new Date(a.created_date);
            if (sortBy === 'dateModified')
                return new Date(b.modified_date) - new Date(a.modified_date);
            return 0;
        });

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

    return (
        <div>
            <div className='mb-4 flex items-center gap-4'>
                <SearchBar
                    onSearch={setSearchQuery}
                    placeholder='Search by name or tag...'
                />
                <div className='flex-none'>
                    <SortMenu sortBy={sortBy} setSortBy={setSortBy} />
                </div>
                <div className='flex-none'>
                    <FilterMenu
                        filterType={filterType}
                        setFilterType={setFilterType}
                        filterValue={filterValue}
                        setFilterValue={setFilterValue}
                        allTags={allTags}
                    />
                </div>
                <div className='flex-none'>
                    <button
                        onClick={toggleSelectionMode}
                        className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                            isSelectionMode
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                        title='Toggle selection mode (Ctrl+A)'>
                        <CheckSquare className='w-4 h-4' />
                        <span className='text-sm'>Select</span>
                    </button>
                </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
                {sortedAndFilteredProfiles.map((profile, index) => (
                    <ProfileCard
                        key={profile.file_name}
                        profile={profile}
                        onEdit={() => handleOpenModal(profile)}
                        onClone={handleCloneProfile}
                        formatDate={formatDate}
                        sortBy={sortBy}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedItems.has(index)}
                        onSelect={e =>
                            handleSelect(
                                profile.content.name,
                                index,
                                e,
                                sortedAndFilteredProfiles
                            )
                        }
                    />
                ))}
            </div>

            {!isSelectionMode && (
                <AddButton
                    onClick={() => handleOpenModal()}
                    label='Add New Profile'
                    top='5vh'
                    left='75vw'
                />
            )}

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
