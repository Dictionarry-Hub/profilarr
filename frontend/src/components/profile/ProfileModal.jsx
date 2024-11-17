import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import {saveProfile, deleteProfile} from '../../api/api';
import Modal from '../ui/Modal';
import Alert from '../ui/Alert';
import {Loader, ArrowUp, ArrowDown} from 'lucide-react';

function unsanitize(text) {
    return text.replace(/\\:/g, ':').replace(/\\n/g, '\n');
}

function ProfileModal({
    profile: initialProfile,
    isOpen,
    onClose,
    onSave,
    formats,
    isCloning = false
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState([]);
    const [newTag, setNewTag] = useState('');
    const [customFormats, setCustomFormats] = useState([]);
    const [formatTags, setFormatTags] = useState([]);
    const [tagScores, setTagScores] = useState({});
    const [tagFilter, setTagFilter] = useState('');
    const [formatFilter, setFormatFilter] = useState('');
    const [error, setError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [modalTitle, setModalTitle] = useState('');
    const [formatSortKey, setFormatSortKey] = useState('score');
    const [formatSortDirection, setFormatSortDirection] = useState('desc');
    const [tagSortKey, setTagSortKey] = useState('name');
    const [tagSortDirection, setTagSortDirection] = useState('desc');

    useEffect(() => {
        if (isOpen) {
            setLoading(true);

            setModalTitle(
                isCloning
                    ? 'Clone Profile'
                    : initialProfile && initialProfile.id !== 0
                    ? 'Edit Profile'
                    : 'Add Profile'
            );

            setName(unsanitize(initialProfile?.name || ''));
            setDescription(unsanitize(initialProfile?.description || ''));
            setTags(
                initialProfile?.tags ? initialProfile.tags.map(unsanitize) : []
            );

            const initialCustomFormats = initialProfile?.custom_formats || [];
            const safeCustomFormats = formats.map(format => {
                const existingFormat = initialCustomFormats.find(
                    cf => cf.id === format.id
                );
                return {
                    id: format.id,
                    name: format.name,
                    score: existingFormat ? existingFormat.score : 0,
                    tags: format.tags || [],
                    date_created: format.date_created,
                    date_modified: format.date_modified
                };
            });
            setCustomFormats(safeCustomFormats);

            const allTags = [
                ...new Set(safeCustomFormats.flatMap(format => format.tags))
            ];
            setFormatTags(allTags);

            const initialTagScores = {};
            allTags.forEach(tag => {
                initialTagScores[tag] = 0;
            });
            setTagScores(initialTagScores);

            setError('');
            setNewTag('');
            setLoading(false);
        }
    }, [initialProfile, isOpen, formats, isCloning]);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Name is required.');
            return;
        }
        try {
            await saveProfile({
                id: initialProfile ? initialProfile.id : 0,
                name,
                description,
                tags,
                custom_formats: customFormats
            });
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving profile:', error);
            setError('Failed to save profile. Please try again.');
        }
    };

    const handleDelete = async () => {
        if (isDeleting) {
            try {
                const response = await deleteProfile(initialProfile.id);
                if (response.error) {
                    Alert.error(
                        `Failed to delete profile: ${response.message}`
                    );
                } else {
                    Alert.success('Profile deleted successfully');
                    onSave();
                    onClose();
                }
            } catch (error) {
                console.error('Error deleting profile:', error);
                Alert.error('Failed to delete profile. Please try again.');
            } finally {
                setIsDeleting(false);
            }
        } else {
            setIsDeleting(true);
        }
    };

    const handleAddTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            setTags([...tags, newTag.trim()]);
            setNewTag('');
        }
    };

    const handleRemoveTag = tagToRemove => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleScoreChange = (formatId, score) => {
        setCustomFormats(
            customFormats.map(format =>
                format.id === formatId
                    ? {...format, score: Math.max(parseInt(score) || 0, 0)}
                    : format
            )
        );
    };

    const handleTagScoreChange = (tag, score) => {
        setTagScores({...tagScores, [tag]: Math.max(parseInt(score) || 0, 0)});

        // Update scores for all custom formats with this tag
        setCustomFormats(
            customFormats.map(format => {
                if (format.tags.includes(tag)) {
                    return {
                        ...format,
                        score: Math.max(parseInt(score) || 0, 0)
                    };
                }
                return format;
            })
        );
    };

    const filteredTags = formatTags.filter(tag =>
        tag.toLowerCase().includes(tagFilter.toLowerCase())
    );

    const filteredFormats = customFormats.filter(format =>
        format.name.toLowerCase().includes(formatFilter.toLowerCase())
    );

    const handleInputFocus = event => {
        event.target.select();
    };

    const sortedFormats = [...filteredFormats].sort((a, b) => {
        if (formatSortKey === 'name') {
            return formatSortDirection === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
        } else if (formatSortKey === 'score') {
            return formatSortDirection === 'asc'
                ? a.score - b.score
                : b.score - a.score;
        } else if (formatSortKey === 'dateCreated') {
            return formatSortDirection === 'asc'
                ? new Date(a.date_created) - new Date(b.date_created)
                : new Date(b.date_created) - new Date(a.date_created);
        } else if (formatSortKey === 'dateModified') {
            return formatSortDirection === 'asc'
                ? new Date(a.date_modified) - new Date(b.date_modified)
                : new Date(b.date_modified) - new Date(a.date_modified);
        }
        return 0;
    });

    const sortedTags = [...filteredTags].sort((a, b) => {
        if (tagSortKey === 'name') {
            return tagSortDirection === 'asc'
                ? a.localeCompare(b)
                : b.localeCompare(a);
        } else if (tagSortKey === 'score') {
            return tagSortDirection === 'asc'
                ? tagScores[a] - tagScores[b]
                : tagScores[b] - tagScores[a];
        } else if (tagSortKey === 'dateCreated') {
            return tagSortDirection === 'asc'
                ? new Date(a.date_created) - new Date(b.date_created)
                : new Date(b.date_created) - new Date(a.date_created);
        } else if (tagSortKey === 'dateModified') {
            return tagSortDirection === 'asc'
                ? new Date(a.date_modified) - new Date(b.date_modified)
                : new Date(b.date_modified) - new Date(a.date_modified);
        }
        return 0;
    });

    const SortDropdown = ({options, currentKey, currentDirection, onSort}) => {
        const [isOpen, setIsOpen] = useState(false);

        const handleSort = key => {
            if (key === currentKey) {
                onSort(key, currentDirection === 'asc' ? 'desc' : 'asc');
            } else {
                onSort(key, 'desc');
            }
            setIsOpen(false);
        };

        return (
            <div className='relative'>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className='flex items-center space-x-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'>
                    <span>Sort</span>
                    <ArrowDown size={14} />
                </button>
                {isOpen && (
                    <div className='absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-10'>
                        {options.map(option => (
                            <button
                                key={option.key}
                                onClick={() => handleSort(option.key)}
                                className='block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'>
                                {option.label}
                                {currentKey === option.key && (
                                    <span className='float-right'>
                                        {currentDirection === 'asc' ? '↑' : '↓'}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
            {loading ? (
                <div className='flex justify-center items-center'>
                    <Loader size={24} className='animate-spin text-gray-300' />
                </div>
            ) : (
                <>
                    {error && <div className='text-red-500 mb-4'>{error}</div>}
                    <div className='grid grid-cols-3 gap-4'>
                        <div>
                            <div className='flex justify-between items-center mb-2'>
                                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                                    Profile Name
                                </label>
                                <div
                                    style={{
                                        visibility: 'hidden',
                                        pointerEvents: 'none'
                                    }}>
                                    <SortDropdown />
                                </div>
                            </div>
                            <div className='flex justify-between items-center mb-4'>
                                <input
                                    type='text'
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder='Enter profile name'
                                    className='w-full p-2 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                                />
                            </div>

                            <div className='mb-4'>
                                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                                    Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e =>
                                        setDescription(e.target.value)
                                    }
                                    placeholder='Enter description'
                                    className='w-full p-2 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 resize-none'
                                    rows='5'
                                />
                            </div>
                            <div className='mb-4'>
                                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                                    Tags
                                </label>
                                <div className='flex flex-wrap mb-2'>
                                    {tags.map(tag => (
                                        <span
                                            key={tag}
                                            className='bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300'>
                                            {tag}
                                            <button
                                                onClick={() =>
                                                    handleRemoveTag(tag)
                                                }
                                                className='ml-1 text-xs'>
                                                &times;
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className='flex'>
                                    <input
                                        type='text'
                                        value={newTag}
                                        onChange={e =>
                                            setNewTag(e.target.value)
                                        }
                                        placeholder='Add a tag'
                                        className='flex-grow p-2 border rounded-l dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                                    />
                                    <button
                                        onClick={handleAddTag}
                                        className='bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600 transition-colors'>
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className='mb-4'>
                                <div className='flex justify-between items-center mb-2'>
                                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                        Custom Formats
                                    </label>
                                    <SortDropdown
                                        options={[
                                            {key: 'name', label: 'Name'},
                                            {key: 'score', label: 'Score'},
                                            {
                                                key: 'dateCreated',
                                                label: 'Date Created'
                                            },
                                            {
                                                key: 'dateModified',
                                                label: 'Date Modified'
                                            }
                                        ]}
                                        currentKey={formatSortKey}
                                        currentDirection={formatSortDirection}
                                        onSort={(key, direction) => {
                                            setFormatSortKey(key);
                                            setFormatSortDirection(direction);
                                        }}
                                    />
                                </div>
                                <input
                                    onClick={handleInputFocus}
                                    type='text'
                                    value={formatFilter}
                                    onChange={e =>
                                        setFormatFilter(e.target.value)
                                    }
                                    placeholder='Filter formats'
                                    className='w-full p-2 border rounded mb-2 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600'
                                />
                                <div className='max-h-96 overflow-y-auto'>
                                    {sortedFormats.map(format => (
                                        <div
                                            key={format.id}
                                            className='flex items-center space-x-2 mb-2 p-2 border rounded dark:border-gray-600 dark:bg-gray-700'>
                                            <span className='flex-grow whitespace-nowrap overflow-hidden text-ellipsis'>
                                                {format.name}
                                            </span>
                                            <input
                                                onClick={handleInputFocus}
                                                type='number'
                                                value={format.score}
                                                onChange={e =>
                                                    handleScoreChange(
                                                        format.id,
                                                        e.target.value
                                                    )
                                                }
                                                className='w-20 p-1 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                                                min='0'
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className='mb-4'>
                                <div className='flex justify-between items-center mb-2'>
                                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                                        Tag-based Scoring
                                    </label>
                                    <SortDropdown
                                        options={[
                                            {key: 'name', label: 'Name'},
                                            {key: 'score', label: 'Score'}
                                        ]}
                                        currentKey={tagSortKey}
                                        currentDirection={tagSortDirection}
                                        onSort={(key, direction) => {
                                            setTagSortKey(key);
                                            setTagSortDirection(direction);
                                        }}
                                    />
                                </div>
                                <input
                                    onClick={handleInputFocus}
                                    type='text'
                                    value={tagFilter}
                                    onChange={e => setTagFilter(e.target.value)}
                                    placeholder='Filter tags'
                                    className='w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:bg-gray-800'
                                />
                                <div className='max-h-96 overflow-y-auto'>
                                    {sortedTags.map(tag => (
                                        <div
                                            key={tag}
                                            className='flex items-center space-x-2 mb-2 p-2 border rounded dark:border-gray-600 dark:bg-gray-700'>
                                            <span className='flex-grow whitespace-nowrap overflow-hidden text-ellipsis'>
                                                {tag}
                                            </span>
                                            <input
                                                onClick={handleInputFocus}
                                                type='number'
                                                value={tagScores[tag]}
                                                onChange={e =>
                                                    handleTagScoreChange(
                                                        tag,
                                                        e.target.value
                                                    )
                                                }
                                                className='w-20 p-1 border rounded dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                                                min='0'
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='flex justify-between mt-4'>
                        {initialProfile && (
                            <button
                                onClick={handleDelete}
                                className={`bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors ${
                                    isDeleting ? 'bg-red-600' : ''
                                }`}>
                                {isDeleting ? 'Confirm Delete' : 'Delete'}
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors'>
                            Save
                        </button>
                    </div>
                </>
            )}
        </Modal>
    );
}

ProfileModal.propTypes = {
    profile: PropTypes.shape({
        id: PropTypes.number,
        name: PropTypes.string,
        description: PropTypes.string,
        tags: PropTypes.arrayOf(PropTypes.string),
        custom_formats: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.number.isRequired,
                name: PropTypes.string,
                score: PropTypes.number,
                tags: PropTypes.arrayOf(PropTypes.string)
            })
        )
    }),
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    formats: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            name: PropTypes.string.isRequired,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    isCloning: PropTypes.bool
};

export default ProfileModal;
