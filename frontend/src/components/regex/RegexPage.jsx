import React, {useState, useEffect} from 'react';
import RegexCard from './RegexCard';
import RegexModal from './RegexModal';
import AddNewCard from '../ui/AddNewCard';
import {RegexPatterns} from '@api/data';
import FilterMenu from '../ui/FilterMenu';
import SortMenu from '../ui/SortMenu';
import {Loader} from 'lucide-react';
import Alert from '@ui/Alert';

function RegexPage() {
    const [patterns, setPatterns] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPattern, setSelectedPattern] = useState(null);
    const [sortBy, setSortBy] = useState('title');
    const [filterType, setFilterType] = useState('none');
    const [filterValue, setFilterValue] = useState('');
    const [allTags, setAllTags] = useState([]);
    const [isCloning, setIsCloning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load initial data
    useEffect(() => {
        loadPatterns();
    }, []);

    const loadPatterns = async () => {
        setIsLoading(true);
        try {
            const response = await RegexPatterns.getAll();
            if (Array.isArray(response)) {
                const patternsData = response.map(item => ({
                    ...item.content,
                    file_name: item.file_name,
                    created_date: item.created_date,
                    modified_date: item.modified_date
                }));
                setPatterns(patternsData);

                // Extract all unique tags
                const tags = new Set();
                patternsData.forEach(pattern => {
                    pattern.tags?.forEach(tag => tags.add(tag));
                });
                setAllTags(Array.from(tags));
            } else {
                Alert.error('Failed to load patterns');
            }
        } catch (error) {
            console.error('Error loading patterns:', error);
            Alert.error('Failed to load patterns');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (pattern = null) => {
        setSelectedPattern(pattern);
        setIsModalOpen(true);
        setIsCloning(false);
    };

    const handleCloseModal = () => {
        setSelectedPattern(null);
        setIsModalOpen(false);
        setIsCloning(false);
    };

    const handleClonePattern = pattern => {
        const clonedPattern = {
            ...pattern,
            name: `${pattern.name} [COPY]`
        };
        setSelectedPattern(clonedPattern);
        setIsModalOpen(true);
        setIsCloning(true);
    };

    const handleSavePattern = async () => {
        await loadPatterns();
        handleCloseModal();
    };

    const getFilteredAndSortedPatterns = () => {
        let filtered = [...patterns];

        // Apply filters
        if (filterType === 'tag' && filterValue) {
            filtered = filtered.filter(pattern =>
                pattern.tags?.includes(filterValue)
            );
        } else if (filterType === 'name' && filterValue) {
            filtered = filtered.filter(pattern =>
                pattern.name.toLowerCase().includes(filterValue.toLowerCase())
            );
        }

        // Apply sorting
        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'dateModified':
                    return (
                        new Date(b.modified_date) - new Date(a.modified_date)
                    );
                case 'dateCreated':
                    return new Date(b.created_date) - new Date(a.created_date);
                case 'name':
                default:
                    return a.name.localeCompare(b.name);
            }
        });
    };

    const formatDate = dateString => {
        return new Date(dateString).toLocaleString();
    };

    if (isLoading) {
        return (
            <div className='flex justify-center items-center h-64'>
                <Loader className='w-8 h-8 animate-spin text-blue-500' />
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
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                {getFilteredAndSortedPatterns().map(pattern => (
                    <RegexCard
                        key={pattern.name}
                        pattern={pattern}
                        onEdit={() => handleOpenModal(pattern)}
                        onClone={handleClonePattern}
                        formatDate={formatDate}
                        sortBy={sortBy}
                    />
                ))}
                <AddNewCard onAdd={() => handleOpenModal()} />
            </div>
            <RegexModal
                pattern={selectedPattern}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSavePattern}
                isCloning={isCloning}
            />
        </div>
    );
}

export default RegexPage;
