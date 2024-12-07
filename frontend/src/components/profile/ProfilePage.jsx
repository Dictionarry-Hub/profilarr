import React, {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import ProfileCard from './ProfileCard';
import ProfileModal from './ProfileModal';
import AddNewCard from '../ui/AddNewCard';
import {getGitStatus} from '../../api/api';
import {Profiles, CustomFormats} from '@api/data';
import FilterMenu from '../ui/FilterMenu';
import SortMenu from '../ui/SortMenu';
import {Loader} from 'lucide-react';
import SearchBar from '@ui/SearchBar';

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

    const navigate = useNavigate();

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
        }
    };

    const handleOpenModal = (profile = null) => {
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
                    profile.content.tags?.some(
                        (
                            tag // Changed from profile.tags
                        ) =>
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
                ); // Changed from profile.tags
            }
            if (filterType === 'date') {
                const profileDate = new Date(profile.modified_date); // This looks correct already
                const filterDate = new Date(filterValue);
                return profileDate.toDateString() === filterDate.toDateString();
            }
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'name')
                return a.content.name.localeCompare(b.content.name); // Changed from a.name
            if (sortBy === 'dateCreated')
                return new Date(b.created_date) - new Date(a.created_date);
            if (sortBy === 'dateModified')
                return new Date(b.modified_date) - new Date(a.modified_date);
            return 0;
        });

    const hasConflicts = mergeConflicts.length > 0;

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
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4'>
                {sortedAndFilteredProfiles.map(profile => (
                    <ProfileCard
                        key={profile.file_name}
                        profile={profile}
                        onEdit={() => handleOpenModal(profile)}
                        onClone={handleCloneProfile}
                        formatDate={formatDate}
                        sortBy={sortBy}
                    />
                ))}
                <AddNewCard onAdd={() => handleOpenModal()} />
            </div>
            <ProfileModal
                profile={selectedProfile}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveProfile}
                formats={formats}
                isCloning={isCloning}
            />
        </div>
    );
}

export default ProfilePage;
