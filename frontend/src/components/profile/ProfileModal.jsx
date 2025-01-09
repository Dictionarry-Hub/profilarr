import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import {Profiles} from '@api/data';
import Modal from '../ui/Modal';
import Alert from '@ui/Alert';
import {Loader} from 'lucide-react';
import ProfileGeneralTab from './ProfileGeneralTab';
import ProfileScoringTab from './ProfileScoringTab';
import ProfileQualitiesTab from './ProfileQualitiesTab';
import ProfileLangaugesTab from './ProfileLangaugesTab';
import ProfileTweaksTab from './ProfileTweaksTab';
import QUALITIES from '../../constants/qualities';

const DEFAULT_TWEAKS = {
    preferFreeleech: true,
    allowLosslessAudio: true,
    allowDVNoFallback: false,
    allowBleedingEdgeCodecs: false,
    allowPrereleases: false
};

function unsanitize(text) {
    if (!text) return '';
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
    // General state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [modalTitle, setModalTitle] = useState('');

    // Tags state
    const [tags, setTags] = useState([]);

    // Format scoring state
    const [customFormats, setCustomFormats] = useState([]);
    const [formatTags, setFormatTags] = useState([]);
    const [formatFilter, setFormatFilter] = useState('');
    const [formatSortKey, setFormatSortKey] = useState('score');
    const [formatSortDirection, setFormatSortDirection] = useState('desc');

    // Tag scoring state
    const [tagScores, setTagScores] = useState({});
    const [tagFilter, setTagFilter] = useState('');
    const [tagSortKey, setTagSortKey] = useState('name');
    const [tagSortDirection, setTagSortDirection] = useState('desc');

    // Upgrade state
    const [upgradesAllowed, setUpgradesAllowed] = useState(false);
    const [minCustomFormatScore, setMinCustomFormatScore] = useState(0);
    const [upgradeUntilScore, setUpgradeUntilScore] = useState(0);
    const [minScoreIncrement, setMinScoreIncrement] = useState(0);

    // Quality state
    const [enabledQualities, setEnabledQualities] = useState([]);
    const [selectedUpgradeQuality, setSelectedUpgradeQuality] = useState(null);
    const [sortedQualities, setSortedQualities] = useState([]);

    // Language state
    const [language, setLanguage] = useState('must_english');

    // Tweaks state
    const [tweaks, setTweaks] = useState(DEFAULT_TWEAKS);

    const tabs = [
        {id: 'general', label: 'General'},
        {id: 'scoring', label: 'Scoring'},
        {id: 'qualities', label: 'Qualities'},
        {id: 'languages', label: 'Languages'},
        {id: 'tweaks', label: 'Tweaks'}
    ];

    const resetState = () => {
        // General state
        setName('');
        setDescription('');
        setError('');
        setTags([]);

        // Format scoring state
        const safeCustomFormats = formats.map(format => ({
            id: format.name,
            name: format.name,
            score: 0,
            tags: format.tags || []
        }));
        setCustomFormats(safeCustomFormats);

        // Reset all other states to defaults
        setUpgradesAllowed(false);
        setMinCustomFormatScore(0);
        setUpgradeUntilScore(0);
        setMinScoreIncrement(0);

        // Set default quality
        const defaultQuality = QUALITIES.find(q => q.name === 'Bluray-1080p');
        setSortedQualities(
            QUALITIES.map(quality => ({
                ...quality,
                enabled: quality.id === defaultQuality.id
            }))
        );
        setEnabledQualities([
            {
                id: defaultQuality.id,
                name: defaultQuality.name
            }
        ]);
        setSelectedUpgradeQuality({
            id: defaultQuality.id,
            name: defaultQuality.name
        });

        // Reset other states
        setLanguage('must_english');
        setTweaks(DEFAULT_TWEAKS);
    };

    useEffect(() => {
        if (isOpen) {
            setLoading(true);

            setModalTitle(
                isCloning
                    ? 'Clone Profile'
                    : initialProfile
                    ? 'Edit Profile'
                    : 'Add Profile'
            );
            if (!initialProfile && !isCloning) {
                resetState();
            } else if (initialProfile?.content) {
                const content = initialProfile.content;
                // Basic info
                setName(unsanitize(content.name || ''));
                setDescription(unsanitize(content.description || ''));
                setTags(content.tags?.map(unsanitize) || []);

                // Language
                setLanguage(content.language || 'must_english');

                // Upgrade settings
                setUpgradesAllowed(content.upgradesAllowed || false);
                setMinCustomFormatScore(
                    Number(content.minCustomFormatScore || 0)
                );
                setUpgradeUntilScore(Number(content.upgradeUntilScore || 0));
                setMinScoreIncrement(Number(content.minScoreIncrement || 0));

                // Custom formats setup
                const initialCustomFormats = content.custom_formats || [];
                const safeCustomFormats = formats.map(format => ({
                    id: format.name,
                    name: format.name,
                    score:
                        initialCustomFormats.find(cf => cf.name === format.name)
                            ?.score || 0,
                    tags: format.tags || []
                }));
                setCustomFormats(safeCustomFormats);

                // Format tags
                const allTags = [
                    ...new Set(
                        safeCustomFormats.flatMap(format => format.tags || [])
                    )
                ];
                setFormatTags(allTags);

                // Tag scores
                const initialTagScores = {};
                allTags.forEach(tag => {
                    initialTagScores[tag] = 0;
                });
                setTagScores(initialTagScores);

                // Tweaks
                setTweaks({
                    ...DEFAULT_TWEAKS,
                    ...(content.tweaks || {})
                });

                // Qualities setup - include all qualities, set enabled status
                const allQualitiesMap = {}; // Map of all qualities by id
                QUALITIES.forEach(quality => {
                    allQualitiesMap[quality.id] = {...quality, enabled: false};
                });

                let newSortedQualities = [];

                if (content.qualities && content.qualities.length > 0) {
                    // Process the qualities from content.qualities
                    content.qualities.forEach(q => {
                        if (q.qualities) {
                            // It's a group
                            const groupQualities = q.qualities
                                .map(subQ => {
                                    const quality = allQualitiesMap[subQ.id];
                                    if (quality) {
                                        quality.enabled = true;
                                        return quality;
                                    }
                                    return null;
                                })
                                .filter(Boolean);

                            newSortedQualities.push({
                                id: q.id,
                                name: q.name,
                                description: q.description,
                                qualities: groupQualities,
                                enabled: true
                            });

                            // Remove sub qualities from allQualitiesMap
                            q.qualities.forEach(subQ => {
                                delete allQualitiesMap[subQ.id];
                            });
                        } else {
                            // It's a single quality
                            const quality = allQualitiesMap[q.id];
                            if (quality) {
                                quality.enabled = true;
                                newSortedQualities.push(quality);
                                delete allQualitiesMap[q.id];
                            }
                        }
                    });
                }

                // Now, add the remaining qualities from allQualitiesMap
                newSortedQualities = newSortedQualities.concat(
                    Object.values(allQualitiesMap)
                );
                setSortedQualities(newSortedQualities);

                // Now, set enabledQualities
                const enabledQualities = [];
                newSortedQualities.forEach(q => {
                    if (q.enabled) {
                        if ('qualities' in q) {
                            enabledQualities.push(...q.qualities);
                        } else {
                            enabledQualities.push(q);
                        }
                    }
                });
                setEnabledQualities(enabledQualities);

                // Set selected upgrade quality
                if (content.upgrade_until) {
                    // Find existing quality or group that matches the upgrade_until
                    let foundQuality = null;

                    // Search through sorted qualities
                    for (const quality of newSortedQualities) {
                        if (quality.id === content.upgrade_until.id) {
                            // Direct match
                            foundQuality = quality;
                            break;
                        } else if ('qualities' in quality) {
                            // Check if any quality in the group matches
                            for (const groupQuality of quality.qualities) {
                                if (
                                    groupQuality.id === content.upgrade_until.id
                                ) {
                                    foundQuality = quality; // Use the group
                                    break;
                                }
                            }
                            if (foundQuality) break;
                        }
                    }

                    setSelectedUpgradeQuality(foundQuality);
                }

                setError('');
            } else {
                // New profile setup
                const safeCustomFormats = formats.map(format => ({
                    id: format.name,
                    name: format.name,
                    score: 0,
                    tags: format.tags || []
                }));
                setCustomFormats(safeCustomFormats);

                // Format tags
                const allTags = [
                    ...new Set(
                        safeCustomFormats.flatMap(format => format.tags || [])
                    )
                ];
                setFormatTags(allTags);

                // Tag scores
                const initialTagScores = {};
                allTags.forEach(tag => {
                    initialTagScores[tag] = 0;
                });
                setTagScores(initialTagScores);

                // New profile - set default quality
                const defaultQuality = QUALITIES.find(
                    q => q.name === 'Bluray-1080p'
                );
                setSortedQualities(
                    QUALITIES.map(quality => ({
                        ...quality,
                        enabled: quality.id === defaultQuality.id
                    }))
                );
                setEnabledQualities([
                    {
                        id: defaultQuality.id,
                        name: defaultQuality.name
                    }
                ]);
                setSelectedUpgradeQuality({
                    id: defaultQuality.id,
                    name: defaultQuality.name
                });

                // Initialize with defaults
                setLanguage('must_english');
                setTweaks(DEFAULT_TWEAKS);
            }

            setLoading(false);
        }
    }, [initialProfile, isOpen, formats, isCloning]);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Name is required.');
            Alert.error('Please enter a profile name');
            return;
        }

        try {
            const profileData = {
                name,
                description,
                tags,
                upgradesAllowed,
                minCustomFormatScore,
                upgradeUntilScore,
                minScoreIncrement,
                custom_formats: customFormats
                    .filter(format => format.score !== 0)
                    .sort((a, b) => {
                        // First sort by score (descending)
                        if (b.score !== a.score) {
                            return b.score - a.score;
                        }
                        // Then alphabetically for equal scores
                        return a.name.localeCompare(b.name);
                    })
                    .map(format => ({
                        name: format.name,
                        score: format.score
                    })),
                qualities: sortedQualities
                    .filter(q => q.enabled)
                    .map(q => {
                        if ('qualities' in q) {
                            return {
                                id: q.id,
                                name: q.name,
                                description: q.description || '',
                                qualities: q.qualities.map(subQ => ({
                                    id: subQ.id,
                                    name: subQ.name
                                }))
                            };
                        } else {
                            return {
                                id: q.id,
                                name: q.name
                            };
                        }
                    }),
                upgrade_until: selectedUpgradeQuality
                    ? {
                          id: selectedUpgradeQuality.id,
                          name: selectedUpgradeQuality.name,
                          ...(selectedUpgradeQuality.description && {
                              description: selectedUpgradeQuality.description
                          })
                      }
                    : null,
                language,
                tweaks
            };

            if (isCloning || !initialProfile) {
                // Creating new profile
                await Profiles.create(profileData);
                Alert.success('Profile created successfully');
            } else {
                // Updating existing profile
                const originalName = initialProfile.content.name;
                const isNameChanged = originalName !== name;
                await Profiles.update(
                    initialProfile.file_name.replace('.yml', ''),
                    profileData,
                    isNameChanged ? name : undefined
                );
                Alert.success('Profile updated successfully');
            }

            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving profile:', error);
            const errorMessage =
                error.message || 'An unexpected error occurred';
            Alert.error(errorMessage);
            setError(errorMessage);
        }
    };

    const handleDelete = async () => {
        if (!initialProfile) return;

        if (isDeleting) {
            try {
                await Profiles.delete(
                    initialProfile.file_name.replace('.yml', '')
                );
                Alert.success('Profile deleted successfully');
                onSave();
                onClose();
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

    const onFormatSort = (key, direction) => {
        setFormatSortKey(key);
        setFormatSortDirection(direction);
    };

    const onTagSort = (key, direction) => {
        setTagSortKey(key);
        setTagSortDirection(direction);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            height='6xl'
            width='4xl'
            tabs={tabs}
            footer={
                <div className='flex justify-between'>
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
            }>
            {activeTab => (
                <div className='h-full'>
                    {loading ? (
                        <div className='flex justify-center items-center'>
                            <Loader
                                size={24}
                                className='animate-spin text-gray-300'
                            />
                        </div>
                    ) : (
                        <div className='h-full'>
                            {activeTab === 'general' && (
                                <ProfileGeneralTab
                                    name={name}
                                    description={description}
                                    upgradesAllowed={upgradesAllowed}
                                    onNameChange={setName}
                                    onDescriptionChange={setDescription}
                                    onUpgradesAllowedChange={setUpgradesAllowed}
                                    error={error}
                                    tags={tags}
                                    onAddTag={tag => setTags([...tags, tag])}
                                    onRemoveTag={tag =>
                                        setTags(tags.filter(t => t !== tag))
                                    }
                                />
                            )}
                            {activeTab === 'scoring' && (
                                <ProfileScoringTab
                                    formats={customFormats}
                                    formatFilter={formatFilter}
                                    onFormatFilterChange={setFormatFilter}
                                    onScoreChange={(id, score) => {
                                        setCustomFormats(prev =>
                                            prev.map(f =>
                                                f.id === id ? {...f, score} : f
                                            )
                                        );
                                    }}
                                    formatSortKey={formatSortKey}
                                    formatSortDirection={formatSortDirection}
                                    onFormatSort={onFormatSort}
                                    tags={formatTags}
                                    tagFilter={tagFilter}
                                    onTagFilterChange={setTagFilter}
                                    tagScores={tagScores}
                                    onTagScoreChange={(tag, score) => {
                                        setTagScores(prev => ({
                                            ...prev,
                                            [tag]: score
                                        }));

                                        setCustomFormats(prev =>
                                            prev.map(format => {
                                                if (
                                                    format.tags?.includes(tag)
                                                ) {
                                                    return {
                                                        ...format,
                                                        score
                                                    };
                                                }
                                                return format;
                                            })
                                        );
                                    }}
                                    tagSortKey={tagSortKey}
                                    tagSortDirection={tagSortDirection}
                                    onTagSort={onTagSort}
                                    minCustomFormatScore={minCustomFormatScore}
                                    upgradeUntilScore={upgradeUntilScore}
                                    minScoreIncrement={minScoreIncrement}
                                    onMinScoreChange={setMinCustomFormatScore}
                                    onUpgradeUntilScoreChange={
                                        setUpgradeUntilScore
                                    }
                                    onMinIncrementChange={setMinScoreIncrement}
                                />
                            )}
                            {activeTab === 'qualities' && (
                                <ProfileQualitiesTab
                                    enabledQualities={enabledQualities}
                                    onQualitiesChange={setEnabledQualities}
                                    upgradesAllowed={upgradesAllowed}
                                    selectedUpgradeQuality={
                                        selectedUpgradeQuality
                                    }
                                    onSelectedUpgradeQualityChange={
                                        setSelectedUpgradeQuality
                                    }
                                    sortedQualities={sortedQualities}
                                    onSortedQualitiesChange={setSortedQualities}
                                />
                            )}
                            {activeTab === 'languages' && (
                                <ProfileLangaugesTab
                                    language={language}
                                    onLanguageChange={setLanguage}
                                />
                            )}
                            {activeTab === 'tweaks' && (
                                <ProfileTweaksTab
                                    tweaks={tweaks}
                                    onTweaksChange={setTweaks}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

ProfileModal.propTypes = {
    profile: PropTypes.shape({
        file_name: PropTypes.string,
        created_date: PropTypes.string,
        modified_date: PropTypes.string,
        content: PropTypes.shape({
            name: PropTypes.string,
            description: PropTypes.string,
            tags: PropTypes.arrayOf(PropTypes.string),
            upgradesAllowed: PropTypes.bool,
            minCustomFormatScore: PropTypes.number,
            upgradeUntilScore: PropTypes.number,
            minScoreIncrement: PropTypes.number,
            custom_formats: PropTypes.arrayOf(
                PropTypes.shape({
                    name: PropTypes.string,
                    score: PropTypes.number
                })
            ),
            qualities: PropTypes.arrayOf(
                PropTypes.shape({
                    id: PropTypes.number.isRequired,
                    name: PropTypes.string.isRequired,
                    qualities: PropTypes.arrayOf(
                        PropTypes.shape({
                            id: PropTypes.number.isRequired,
                            name: PropTypes.string.isRequired
                        })
                    )
                })
            ),
            upgrade_until: PropTypes.shape({
                id: PropTypes.number.isRequired,
                name: PropTypes.string.isRequired
            }),
            language: PropTypes.string,
            tweaks: PropTypes.object
        })
    }),
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    formats: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            tags: PropTypes.arrayOf(PropTypes.string)
        })
    ).isRequired,
    isCloning: PropTypes.bool
};

export default ProfileModal;
