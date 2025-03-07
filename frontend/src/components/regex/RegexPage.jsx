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
import useSearch from '@hooks/useSearch';

const loadingMessages = [
    'Matching all the patterns...',
    'Capturing your groups...',
    'Escaping special characters...',
    'Untangling regular expressions...',
    'Looking behind and ahead...',
    'Validating the validators...'
];

const LoadingState = () => (
    <div className='w-full min-h-[70vh] flex flex-col items-center justify-center'>
        <Loader className='w-8 h-8 animate-spin text-blue-500 mb-4' />
        <p className='text-lg font-medium text-gray-300'>
            {
                loadingMessages[
                    Math.floor(Math.random() * loadingMessages.length)
                ]
            }
        </p>
    </div>
);

function RegexPage() {
    // Basic state
    const [patterns, setPatterns] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPattern, setSelectedPattern] = useState(null);
    const [allTags, setAllTags] = useState([]);
    const [isCloning, setIsCloning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [willBeSelected, setWillBeSelected] = useState([]);

    // Initialize useSearch hook
    const {
        searchTerms,
        currentInput,
        setCurrentInput,
        addSearchTerm,
        removeSearchTerm,
        clearSearchTerms,
        filterType,
        setFilterType,
        filterValue,
        setFilterValue,
        sortBy,
        setSortBy,
        items: filteredPatterns
    } = useSearch(patterns, {
        searchableFields: ['name', 'tags'],
        initialSortBy: 'name',
        sortOptions: {
            name: (a, b) => a.name.localeCompare(b.name),
            dateModified: (a, b) =>
                new Date(b.modified_date) - new Date(a.modified_date)
        }
    });

    // Mass selection functionality
    const {
        selectedItems,
        isSelectionMode,
        toggleSelectionMode,
        handleSelect,
        clearSelection,
        lastSelectedIndex
    } = useMassSelection();

    // Keyboard shortcuts
    useKeyboardShortcut('m', toggleSelectionMode, {ctrl: true});

    // Mouse position tracking for shift-select
    useEffect(() => {
        const handleKeyDown = e => {
            if (e.key === 'Shift' && lastSelectedIndex !== null) {
                const element = document.elementFromPoint(
                    window.mouseX,
                    window.mouseY
                );
                if (element) {
                    const card = element.closest('[data-pattern-index]');
                    if (card) {
                        const index = parseInt(card.dataset.patternIndex);
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

    // Initial load
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
                    modified_date: item.modified_date
                }));
                setPatterns(patternsData);

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
                index => filteredPatterns[index]
            );

            for (const pattern of selectedPatterns) {
                await RegexPatterns.delete(
                    pattern.file_name.replace('.yml', '')
                );
            }
            Alert.success('Selected patterns deleted successfully');
        } catch (error) {
            console.error('Error deleting patterns:', error);
            Alert.error('Failed to delete selected patterns');
        } finally {
            loadPatterns();
            toggleSelectionMode();
            clearSelection();
        }
    };

    const handlePatternSelect = (patternName, index, e) => {
        if (e.shiftKey) {
            handleMouseEnter(index, true);
        }
        handleSelect(patternName, index, e, filteredPatterns);
    };

    const handleMouseEnter = (index, isShiftKey) => {
        if (isShiftKey && lastSelectedIndex !== null) {
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);
            const potentialSelection = filteredPatterns
                .slice(start, end + 1)
                .map((pattern, idx) => idx + start);
            setWillBeSelected(potentialSelection);
        }
    };

    const formatDate = dateString => {
        return new Date(dateString).toLocaleString();
    };

    if (isLoading) {
        return <LoadingState />;
    }

    return (
        <div className='w-full space-y-2'>
            <DataBar
                searchTerms={searchTerms}
                currentInput={currentInput}
                onInputChange={setCurrentInput}
                onAddTerm={addSearchTerm}
                onRemoveTerm={removeSearchTerm}
                onClearTerms={clearSearchTerms}
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

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {filteredPatterns.map((pattern, index) => (
                    <div
                        key={pattern.name}
                        data-pattern-index={index}
                        onMouseEnter={() =>
                            handleMouseEnter(index, window.event?.shiftKey)
                        }
                        onMouseLeave={() => setWillBeSelected([])}>
                        <RegexCard
                            pattern={pattern}
                            onEdit={() => handleOpenModal(pattern)}
                            onClone={handleClonePattern}
                            formatDate={formatDate}
                            sortBy={sortBy}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedItems.has(index)}
                            willBeSelected={willBeSelected.includes(index)}
                            onSelect={e =>
                                handlePatternSelect(pattern.name, index, e)
                            }
                        />
                    </div>
                ))}
            </div>

            {isSelectionMode && (
                <MassActionsBar
                    selectedCount={selectedItems.size}
                    onCancel={() => {
                        toggleSelectionMode();
                        clearSelection();
                    }}
                    onDelete={handleMassDelete}
                    onImport={() => {}}
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
