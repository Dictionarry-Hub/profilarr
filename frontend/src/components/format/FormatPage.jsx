import React, {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import FormatCard from './FormatCard';
import FormatModal from './FormatModal';
import {getGitStatus} from '@api/api';
import {CustomFormats} from '@api/data';
import {Loader} from 'lucide-react';
import Alert from '@ui/Alert';
import {useFormatModal} from '@hooks/useFormatModal';
import {useMassSelection} from '@hooks/useMassSelection';
import {useKeyboardShortcut} from '@hooks/useKeyboardShortcut';
import MassActionsBar from '@ui/MassActionsBar';
import ImportModal from '@ui/ImportModal';
import {importFormats} from '@api/import';
import DataBar from '@ui/DataBar/DataBar';
import useSearch from '@hooks/useSearch';

const loadingMessages = [
    'Formatting the formatters...',
    'Teaching formats to behave...',
    'Convincing formats to follow rules...',
    'Organizing chaos into patterns...',
    'Making formats look pretty...',
    'Polishing the quality filters...'
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

const ConflictState = ({onNavigateSettings}) => (
    <div className='w-full'>
        <div className='mt-8 flex justify-between items-center'>
            <h4 className='text-xl font-extrabold'>Merge Conflicts Detected</h4>
            <button
                onClick={onNavigateSettings}
                className='bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition'>
                Resolve Conflicts
            </button>
        </div>

        <div className='mt-6 p-4 bg-gray-800 rounded-lg shadow-md'>
            <h3 className='text-xl font-semibold'>What Happened?</h3>
            <p className='mt-2 text-gray-300'>
                This page is locked because there are unresolved merge
                conflicts. You need to address these conflicts in the settings
                page before continuing.
            </p>
        </div>
    </div>
);

function FormatPage() {
    const [formats, setFormats] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState(null);
    const [allTags, setAllTags] = useState([]);
    const [isCloning, setIsCloning] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [mergeConflicts, setMergeConflicts] = useState([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [willBeSelected, setWillBeSelected] = useState([]);

    const navigate = useNavigate();

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
        items: filteredFormats
    } = useSearch(formats, {
        searchableFields: ['content.name', 'content.tags'],
        initialSortBy: 'name',
        sortOptions: {
            name: (a, b) => a.content.name.localeCompare(b.content.name),
            dateModified: (a, b) =>
                new Date(b.modified_date) - new Date(a.modified_date)
        }
    });

    const {
        selectedItems,
        isSelectionMode,
        toggleSelectionMode,
        handleSelect,
        clearSelection,
        lastSelectedIndex
    } = useMassSelection();

    useKeyboardShortcut('a', toggleSelectionMode, {ctrl: true});

    const {
        name,
        description,
        tags,
        conditions,
        tests,
        error,
        activeTab,
        isDeleting,
        isRunningTests,
        includeInRename,
        setName,
        setDescription,
        setTags,
        setConditions,
        setTests,
        setActiveTab,
        setIsDeleting,
        setIncludeInRename,
        initializeForm,
        handleSave,
        handleRunTests,
        handleDelete
    } = useFormatModal(selectedFormat, () => {
        fetchFormats();
        handleCloseModal();
    });

    useEffect(() => {
        fetchGitStatus();
    }, []);

    useEffect(() => {
        const handleKeyDown = e => {
            if (e.key === 'Shift' && lastSelectedIndex !== null) {
                const element = document.elementFromPoint(
                    window.mouseX,
                    window.mouseY
                );
                if (element) {
                    const card = element.closest('[data-format-index]');
                    if (card) {
                        const index = parseInt(card.dataset.formatIndex);
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

    const fetchFormats = async () => {
        try {
            const response = await CustomFormats.getAll();
            const formatsData = response.map(item => ({
                file_name: item.file_name,
                modified_date: item.modified_date,
                content: {
                    ...item.content
                }
            }));
            setFormats(formatsData);

            const tags = new Set(
                formatsData.flatMap(format => format.content.tags || [])
            );
            setAllTags(Array.from(tags));
        } catch (error) {
            console.error('Error fetching formats:', error);
            Alert.error('Failed to load custom formats');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (format = null) => {
        if (isSelectionMode) return;
        setSelectedFormat(format);
        setIsModalOpen(true);
        setIsCloning(false);
        initializeForm(format?.content, false);
    };

    const handleCloseModal = () => {
        setSelectedFormat(null);
        setIsModalOpen(false);
        setIsCloning(false);
    };

    const handleCloneFormat = format => {
        if (isSelectionMode) return;
        const clonedFormat = {
            ...format,
            content: {
                ...format.content,
                name: `${format.content.name} [COPY]`
            }
        };
        setSelectedFormat(clonedFormat);
        setIsModalOpen(true);
        setIsCloning(true);
        initializeForm(clonedFormat.content, true);
    };

    const handleMassDelete = async () => {
        try {
            const selectedFormats = Array.from(selectedItems).map(
                index => filteredFormats[index]
            );

            for (const format of selectedFormats) {
                await CustomFormats.delete(
                    format.file_name.replace('.yml', '')
                );
            }
            Alert.success('Selected formats deleted successfully');
        } catch (error) {
            console.error('Error deleting formats:', error);
            Alert.error(
                error.response?.data?.error ||
                    'Failed to delete selected formats'
            );
        } finally {
            fetchFormats();
            toggleSelectionMode();
            clearSelection();
        }
    };

    const handleMassImport = async arr => {
        try {
            const selectedFormats = Array.from(selectedItems).map(
                index => filteredFormats[index]
            );
            const formatNames = selectedFormats.map(format => format.file_name);

            await importFormats(arr, formatNames);
            Alert.success('Formats imported successfully');
            toggleSelectionMode();
        } catch (error) {
            console.error('Error importing formats:', error);
            Alert.error('Failed to import formats');
            throw error;
        }
    };

    const handleFormatSelect = (formatName, index, e) => {
        if (e.shiftKey) {
            handleMouseEnter(index, true);
        }
        handleSelect(formatName, index, e, filteredFormats);
    };

    const handleMouseEnter = (index, isShiftKey) => {
        if (isShiftKey && lastSelectedIndex !== null) {
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);

            const potentialSelection = filteredFormats
                .slice(start, end + 1)
                .map((format, idx) => idx + start);

            setWillBeSelected(potentialSelection);
        }
    };

    if (isLoading) {
        return <LoadingState />;
    }

    if (mergeConflicts.length > 0) {
        return (
            <ConflictState onNavigateSettings={() => navigate('/settings')} />
        );
    }

    return (
        <div className='w-full min-h-[70vh] space-y-2 flex flex-col'>
            <DataBar
                searchTerms={searchTerms}
                currentInput={currentInput}
                onInputChange={setCurrentInput}
                onAddTerm={addSearchTerm}
                onRemoveTerm={removeSearchTerm}
                onClearTerms={clearSearchTerms}
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
                addButtonLabel='Add New Format'
            />

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow'>
                {filteredFormats.map((format, index) => (
                    <div
                        key={format.file_name}
                        data-format-index={index}
                        onMouseEnter={() =>
                            handleMouseEnter(index, window.event?.shiftKey)
                        }
                        onMouseLeave={() => setWillBeSelected([])}>
                        <FormatCard
                            format={format}
                            onEdit={() => handleOpenModal(format)}
                            onClone={handleCloneFormat}
                            sortBy={sortBy}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedItems.has(index)}
                            willBeSelected={willBeSelected.includes(index)}
                            onSelect={e =>
                                handleFormatSelect(
                                    format.content.name,
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
                    onCancel={() => {
                        toggleSelectionMode();
                        clearSelection();
                    }}
                    onDelete={handleMassDelete}
                    onImport={() => setIsImportModalOpen(true)}
                />
            )}

            <FormatModal
                format={selectedFormat}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                isCloning={isCloning}
                name={name}
                description={description}
                tags={tags}
                conditions={conditions}
                tests={tests}
                error={error}
                activeTab={activeTab}
                isDeleting={isDeleting}
                isRunningTests={isRunningTests}
                onNameChange={setName}
                onDescriptionChange={setDescription}
                onTagsChange={setTags}
                onConditionsChange={setConditions}
                onTestsChange={setTests}
                onActiveTabChange={setActiveTab}
                onDeletingChange={setIsDeleting}
                onRunTests={handleRunTests}
                onSave={handleSave}
                onDelete={handleDelete}
                includeInRename={includeInRename}
                onIncludeInRenameChange={setIncludeInRename}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleMassImport}
                type='Formats'
            />
        </div>
    );
}

export default FormatPage;
