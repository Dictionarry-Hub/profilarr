import React, {useState, useEffect} from 'react';
import RegexCard from './RegexCard';
import RegexModal from './RegexModal';
import {RegexPatterns} from '@api/data';
import {Loader} from 'lucide-react';
import Alert from '@ui/Alert';
import {useMassSelection} from '@hooks/useMassSelection';
import {useKeyboardShortcut} from '@hooks/useKeyboardShortcut';
import MassActionsBar from '@ui/MassActionsBar';
import DataBar from '@ui/DataBar/DataBar';

function RegexPage() {
    const [patterns, setPatterns] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPattern, setSelectedPattern] = useState(null);
    const [sortBy, setSortBy] = useState('name');
    const [filterType, setFilterType] = useState('none');
    const [filterValue, setFilterValue] = useState('');
    const [allTags, setAllTags] = useState([]);
    const [isCloning, setIsCloning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

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
        if (isSelectionMode) return;
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
        if (isSelectionMode) return;
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

    const handleMassDelete = async () => {
        try {
            const selectedPatterns = Array.from(selectedItems).map(
                index => patterns[index]
            );
            for (const pattern of selectedPatterns) {
                await RegexPatterns.delete(
                    pattern.file_name.replace('.yml', '')
                );
            }
            Alert.success('Selected patterns deleted successfully');
            loadPatterns();
            toggleSelectionMode();
        } catch (error) {
            console.error('Error deleting patterns:', error);
            Alert.error('Failed to delete selected patterns');
        }
    };

    const getFilteredAndSortedPatterns = () => {
        let filtered = [...patterns];

        // Apply search filter
        if (searchQuery) {
            filtered = filtered.filter(
                pattern =>
                    pattern.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    pattern.tags?.some(tag =>
                        tag.toLowerCase().includes(searchQuery.toLowerCase())
                    )
            );
        }

        // Apply existing filters
        if (filterType === 'tag' && filterValue) {
            filtered = filtered.filter(pattern =>
                pattern.tags?.includes(filterValue)
            );
        }

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
                addButtonLabel='Add New Pattern'
            />

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                {getFilteredAndSortedPatterns().map((pattern, index) => (
                    <RegexCard
                        key={pattern.name}
                        pattern={pattern}
                        onEdit={() => handleOpenModal(pattern)}
                        onClone={handleClonePattern}
                        formatDate={formatDate}
                        sortBy={sortBy}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedItems.has(index)}
                        onSelect={e =>
                            handleSelect(pattern.file_name, index, e)
                        }
                    />
                ))}
            </div>

            {isSelectionMode && (
                <MassActionsBar
                    selectedCount={selectedItems.size}
                    onCancel={toggleSelectionMode}
                    onDelete={handleMassDelete}
                    showImport={false}
                />
            )}

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
