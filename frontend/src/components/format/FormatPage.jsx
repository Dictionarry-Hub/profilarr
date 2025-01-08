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

function FormatPage() {
    // Basic state management
    const [formats, setFormats] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState(null);
    const [sortBy, setSortBy] = useState('name');
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

    // Format modal hook integration
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
        setName,
        setDescription,
        setTags,
        setConditions,
        setTests,
        setActiveTab,
        setIsDeleting,
        initializeForm,
        handleSave,
        handleRunTests,
        handleDelete
    } = useFormatModal(selectedFormat, () => {
        fetchFormats();
        handleCloseModal();
    });

    const loadingMessages = [
        'Loading custom formats...',
        'Analyzing format conditions...',
        'Preparing format library...',
        'Syncing format database...',
        'Organizing media formats...'
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
                created_date: item.created_date,
                content: {
                    ...item.content
                }
            }));
            setFormats(formatsData);

            // Extract all unique tags
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
                index => formats[index]
            );
            for (const format of selectedFormats) {
                await CustomFormats.delete(
                    format.file_name.replace('.yml', '')
                );
            }
            Alert.success('Selected formats deleted successfully');
            fetchFormats();
            toggleSelectionMode();
        } catch (error) {
            console.error('Error deleting formats:', error);
            Alert.error('Failed to delete selected formats');
        }
    };

    const handleMassImport = async arr => {
        try {
            const formatNames = Array.from(selectedItems);
            await importFormats(arr, formatNames);
            Alert.success('Formats imported successfully');
            toggleSelectionMode();
        } catch (error) {
            console.error('Error importing formats:', error);
            Alert.error('Failed to import formats');
            throw error;
        }
    };

    const getFilteredAndSortedFormats = () => {
        let filtered = [...formats];

        // Apply search filter
        if (searchQuery) {
            filtered = filtered.filter(
                format =>
                    format.content.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    format.content.tags?.some(tag =>
                        tag.toLowerCase().includes(searchQuery.toLowerCase())
                    )
            );
        }

        // Apply existing filters
        if (filterType === 'tag' && filterValue) {
            filtered = filtered.filter(format =>
                format.content.tags?.includes(filterValue)
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
                    return a.content.name.localeCompare(b.content.name);
            }
        });
    };

    if (isLoading) {
        return (
            <div className='flex flex-col items-center justify-center h-64'>
                <Loader className='w-8 h-8 animate-spin text-blue-500 mb-4' />
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
            <div className='text-gray-900 dark:text-white'>
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

                <div className='mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md'>
                    <h3 className='text-xl font-semibold'>What Happened?</h3>
                    <p className='mt-2 text-gray-600 dark:text-gray-300'>
                        This page is locked because there are unresolved merge
                        conflicts. You need to address these conflicts in the
                        settings page before continuing.
                    </p>
                </div>
            </div>
        );
    }

    const filteredFormats = getFilteredAndSortedFormats();

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
                addButtonLabel='Add New Format'
            />

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4'>
                {filteredFormats.map((format, index) => (
                    <FormatCard
                        key={format.file_name}
                        format={format}
                        onEdit={() => handleOpenModal(format)}
                        onClone={handleCloneFormat}
                        sortBy={sortBy}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedItems.has(format.content.name)}
                        onSelect={e =>
                            handleSelect(
                                format.content.name,
                                index,
                                e,
                                filteredFormats
                            )
                        }
                    />
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
