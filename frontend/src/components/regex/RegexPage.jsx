import React, {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import RegexCard from './RegexCard';
import RegexModal from './RegexModal';
import AddNewCard from '../ui/AddNewCard';
import {getRegexes} from '../../api/api';
import FilterMenu from '../ui/FilterMenu';
import SortMenu from '../ui/SortMenu';
import {Loader} from 'lucide-react';
import {getGitStatus} from '../../api/api';

function RegexPage() {
    const [regexes, setRegexes] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRegex, setSelectedRegex] = useState(null);
    const [sortBy, setSortBy] = useState('title');
    const [filterType, setFilterType] = useState('none');
    const [filterValue, setFilterValue] = useState('');
    const [allTags, setAllTags] = useState([]);
    const [isCloning, setIsCloning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [mergeConflicts, setMergeConflicts] = useState([]);

    const navigate = useNavigate();

    const loadingMessages = [
        'Compiling complex patterns...',
        'Analyzing regex efficiency...',
        'Optimizing search algorithms...',
        'Testing pattern boundaries...',
        'Loading regex libraries...',
        'Parsing intricate expressions...',
        'Detecting pattern conflicts...',
        'Refactoring nested groups...'
    ];

    useEffect(() => {
        fetchGitStatus();
    }, []);

    const fetchRegexes = async () => {
        try {
            const fetchedRegexes = await getRegexes();
            setRegexes(fetchedRegexes);
            const tags = [
                ...new Set(fetchedRegexes.flatMap(regex => regex.tags || []))
            ];
            setAllTags(tags);
        } catch (error) {
            console.error('Error fetching regexes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchGitStatus = async () => {
        try {
            const result = await getGitStatus();
            if (result.success) {
                setMergeConflicts(result.data.merge_conflicts || []);
                if (result.data.merge_conflicts.length === 0) {
                    fetchRegexes();
                } else {
                    setIsLoading(false);
                }
            }
        } catch (error) {
            console.error('Error fetching Git status:', error);
            setIsLoading(false);
        }
    };

    const handleOpenModal = (regex = null) => {
        setSelectedRegex(regex);
        setIsModalOpen(true);
        setIsCloning(false);
    };

    const handleCloseModal = () => {
        setSelectedRegex(null);
        setIsModalOpen(false);
        setIsCloning(false);
    };

    const handleCloneRegex = regex => {
        const clonedRegex = {
            ...regex,
            id: 0,
            name: `${regex.name} [COPY]`,
            regex101Link: ''
        };
        setSelectedRegex(clonedRegex);
        setIsModalOpen(true);
        setIsCloning(true);
    };

    const handleSaveRegex = () => {
        fetchRegexes();
        handleCloseModal();
    };

    const formatDate = dateString => {
        return new Date(dateString).toLocaleString();
    };

    const sortedAndFilteredRegexes = regexes
        .filter(regex => {
            if (filterType === 'tag') {
                return regex.tags && regex.tags.includes(filterValue);
            }
            if (filterType === 'date') {
                const regexDate = new Date(regex.date_modified);
                const filterDate = new Date(filterValue);
                return regexDate.toDateString() === filterDate.toDateString();
            }
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'title') return a.name.localeCompare(b.name);
            if (sortBy === 'dateCreated')
                return new Date(b.date_created) - new Date(a.date_created);
            if (sortBy === 'dateModified')
                return new Date(b.date_modified) - new Date(a.date_modified);
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
            <h2 className='text-2xl font-bold mb-4'>Manage Regex Patterns</h2>
            <div className='mb-4 flex items-center space-x-4'>
                <SortMenu sortBy={sortBy} setSortBy={setSortBy} />
                <FilterMenu
                    filterType={filterType}
                    setFilterType={setFilterType}
                    filterValue={filterValue}
                    setFilterValue={setFilterValue}
                    allTags={allTags}
                />
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4'>
                {sortedAndFilteredRegexes.map(regex => (
                    <RegexCard
                        key={regex.id}
                        regex={regex}
                        onEdit={() => handleOpenModal(regex)}
                        onClone={handleCloneRegex} // Pass the clone handler
                        showDate={sortBy !== 'title'}
                        formatDate={formatDate}
                    />
                ))}
                <AddNewCard onAdd={() => handleOpenModal()} />
            </div>
            <RegexModal
                regex={selectedRegex}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveRegex}
                allTags={allTags}
                isCloning={isCloning}
            />
        </div>
    );
}

export default RegexPage;
