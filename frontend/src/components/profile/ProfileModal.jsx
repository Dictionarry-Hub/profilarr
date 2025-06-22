import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import {Profiles} from '@api/data';
import Modal from '../ui/Modal';
import Alert from '@ui/Alert';
import {Loader, Save, Trash2, Check} from 'lucide-react';
import ProfileGeneralTab from './ProfileGeneralTab';
import ProfileScoringTab from './scoring/ProfileScoringTab';
import ProfileQualitiesTab from './quality/ProfileQualitiesTab';
import ProfileLangaugesTab from './language/ProfileLangaugesTab';
import QUALITIES from '../../constants/qualities';

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
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [modalTitle, setModalTitle] = useState('');

    // Tags state
    const [tags, setTags] = useState([]);

    // Format scoring state - now app-specific
    const [customFormats, setCustomFormats] = useState({
        both: [],
        radarr: [],
        sonarr: []
    });
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

    const tabs = [
        {id: 'general', label: 'General'},
        {id: 'scoring', label: 'Scoring'},
        {id: 'qualities', label: 'Qualities'},
        {id: 'languages', label: 'Languages'}
    ];

    const resetState = () => {
        // General state
        setName('');
        setDescription('');
        setError('');
        setTags([]);

        // Format scoring state - initialize all apps with all formats at score 0
        const safeCustomFormats = formats.map(format => ({
            id: format.name,
            name: format.name,
            score: 0,
            tags: format.tags || []
        }));
        setCustomFormats({
            both: [...safeCustomFormats],
            radarr: [...safeCustomFormats],
            sonarr: [...safeCustomFormats]
        });

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
    };

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setIsDeleting(false);
            setIsSaving(false);

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

                // Custom formats setup - handle backwards compatible format
                const initialCustomFormats = content.custom_formats || [];
                const initialCustomFormatsRadarr = content.custom_formats_radarr || [];
                const initialCustomFormatsSonarr = content.custom_formats_sonarr || [];
                
                setCustomFormats({
                    both: formats.map(format => ({
                        id: format.name,
                        name: format.name,
                        score: initialCustomFormats.find(cf => cf.name === format.name)?.score || 0,
                        tags: format.tags || []
                    })),
                    radarr: formats.map(format => ({
                        id: format.name,
                        name: format.name,
                        score: initialCustomFormatsRadarr.find(cf => cf.name === format.name)?.score || 0,
                        tags: format.tags || []
                    })),
                    sonarr: formats.map(format => ({
                        id: format.name,
                        name: format.name,
                        score: initialCustomFormatsSonarr.find(cf => cf.name === format.name)?.score || 0,
                        tags: format.tags || []
                    }))
                });

                // Format tags
                const allTags = [
                    ...new Set(
                        formats.flatMap(format => format.tags || [])
                    )
                ];
                setFormatTags(allTags);

                // Tag scores
                const initialTagScores = {};
                allTags.forEach(tag => {
                    initialTagScores[tag] = 0;
                });
                setTagScores(initialTagScores);

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
                setCustomFormats({
                    both: [...safeCustomFormats],
                    radarr: [...safeCustomFormats],
                    sonarr: [...safeCustomFormats]
                });

                // Format tags
                const allTags = [
                    ...new Set(
                        formats.flatMap(format => format.tags || [])
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
            }

            setLoading(false);
        }
    }, [initialProfile, isOpen, formats, isCloning]);

    const handleSave = async () => {
        if (isSaving) {
            // This is the confirmation click
            if (!name.trim()) {
                setError('Name is required.');
                Alert.error('Please enter a profile name');
                setIsSaving(false);
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
                    custom_formats: (() => {
                        // Check if selective mode is enabled
                        const selectiveMode = localStorage.getItem('formatSettingsSelectiveMode');
                        const useSelectiveMode = selectiveMode !== null && JSON.parse(selectiveMode);
                        
                        // Helper function to process formats for an app type
                        const processFormats = (appFormats, appType) => {
                            if (useSelectiveMode) {
                                try {
                                    // Get the list of explicitly selected format IDs for this app
                                    const selectedFormatIdsStr = localStorage.getItem(`selectedFormatIds_${appType}`);
                                    const selectedFormatIds = selectedFormatIdsStr ? JSON.parse(selectedFormatIdsStr) : [];

                                    // Get formats with non-zero scores
                                    const nonZeroFormats = appFormats.filter(format => format.score !== 0);

                                    // Get formats with zero scores that are explicitly selected
                                    const explicitlySelectedZeroFormats = appFormats.filter(
                                        format => format.score === 0 && selectedFormatIds.includes(format.id)
                                    );

                                    // Combine both lists
                                    return [...nonZeroFormats, ...explicitlySelectedZeroFormats]
                                        .sort((a, b) => {
                                            if (b.score !== a.score) return b.score - a.score;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map(format => ({
                                            name: format.name,
                                            score: format.score
                                        }));
                                } catch (e) {
                                    // Fallback to just non-zero scores
                                    return appFormats
                                        .filter(format => format.score !== 0)
                                        .sort((a, b) => {
                                            if (b.score !== a.score) return b.score - a.score;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map(format => ({
                                            name: format.name,
                                            score: format.score
                                        }));
                                }
                            } else {
                                // Standard behavior - only include formats with non-zero scores
                                return appFormats
                                    .filter(format => format.score !== 0)
                                    .sort((a, b) => {
                                        if (b.score !== a.score) return b.score - a.score;
                                        return a.name.localeCompare(b.name);
                                    })
                                    .map(format => ({
                                        name: format.name,
                                        score: format.score
                                    }));
                            }
                        };

                        // Always save "both" formats as the main custom_formats field for backwards compatibility
                        return processFormats(customFormats.both || [], 'both');
                    })(),
                    ...((() => {
                        // Check if selective mode is enabled
                        const selectiveMode = localStorage.getItem('formatSettingsSelectiveMode');
                        const useSelectiveMode = selectiveMode !== null && JSON.parse(selectiveMode);
                        
                        // Helper function to process formats for an app type
                        const processFormats = (appFormats, appType) => {
                            if (useSelectiveMode) {
                                try {
                                    // Get the list of explicitly selected format IDs for this app
                                    const selectedFormatIdsStr = localStorage.getItem(`selectedFormatIds_${appType}`);
                                    const selectedFormatIds = selectedFormatIdsStr ? JSON.parse(selectedFormatIdsStr) : [];

                                    // Get formats with non-zero scores
                                    const nonZeroFormats = appFormats.filter(format => format.score !== 0);

                                    // Get formats with zero scores that are explicitly selected
                                    const explicitlySelectedZeroFormats = appFormats.filter(
                                        format => format.score === 0 && selectedFormatIds.includes(format.id)
                                    );

                                    // Combine both lists
                                    return [...nonZeroFormats, ...explicitlySelectedZeroFormats]
                                        .sort((a, b) => {
                                            if (b.score !== a.score) return b.score - a.score;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map(format => ({
                                            name: format.name,
                                            score: format.score
                                        }));
                                } catch (e) {
                                    // Fallback to just non-zero scores
                                    return appFormats
                                        .filter(format => format.score !== 0)
                                        .sort((a, b) => {
                                            if (b.score !== a.score) return b.score - a.score;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .map(format => ({
                                            name: format.name,
                                            score: format.score
                                        }));
                                }
                            } else {
                                // Standard behavior - only include formats with non-zero scores
                                return appFormats
                                    .filter(format => format.score !== 0)
                                    .sort((a, b) => {
                                        if (b.score !== a.score) return b.score - a.score;
                                        return a.name.localeCompare(b.name);
                                    })
                                    .map(format => ({
                                        name: format.name,
                                        score: format.score
                                    }));
                            }
                        };

                        // Always include app-specific formats as separate fields (empty arrays if no scores)
                        const radarrFormats = processFormats(customFormats.radarr || [], 'radarr');
                        const sonarrFormats = processFormats(customFormats.sonarr || [], 'sonarr');
                        
                        return {
                            custom_formats_radarr: radarrFormats,
                            custom_formats_sonarr: sonarrFormats
                        };
                    })()),
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
                    language
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
                setIsSaving(false);
            }
        } else {
            // First click - show confirmation
            setIsSaving(true);
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
                            className='inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors'>
                            {isDeleting ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : (
                                <Trash2 className="w-4 h-4 text-red-500" />
                            )}
                            <span>Delete</span>
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        className='inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors'>
                        {isSaving ? (
                            <Check className="w-4 h-4 text-green-500" />
                        ) : (
                            <Save className="w-4 h-4 text-blue-500" />
                        )}
                        <span>Save</span>
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
                                    onNameChange={setName}
                                    onDescriptionChange={setDescription}
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
                                    customFormats={customFormats}
                                    formatFilter={formatFilter}
                                    onFormatFilterChange={setFormatFilter}
                                    onScoreChange={(appType, id, score) => {
                                        setCustomFormats(prev => {
                                            const newFormats = {...prev};
                                            
                                            // If setting a non-zero score, handle conflicts
                                            if (score !== 0) {
                                                if (appType === 'both') {
                                                    // Setting in "both" clears radarr AND sonarr
                                                    newFormats.radarr = newFormats.radarr.map(f =>
                                                        f.id === id ? {...f, score: 0} : f
                                                    );
                                                    newFormats.sonarr = newFormats.sonarr.map(f =>
                                                        f.id === id ? {...f, score: 0} : f
                                                    );
                                                } else {
                                                    // Setting in radarr/sonarr only clears "both"
                                                    newFormats.both = newFormats.both.map(f =>
                                                        f.id === id ? {...f, score: 0} : f
                                                    );
                                                }
                                            }
                                            
                                            // Update the target app type
                                            newFormats[appType] = newFormats[appType].map(f =>
                                                f.id === id ? {...f, score} : f
                                            );
                                            
                                            return newFormats;
                                        });
                                    }}
                                    formatSortKey={formatSortKey}
                                    formatSortDirection={formatSortDirection}
                                    onFormatSort={onFormatSort}
                                    tags={formatTags}
                                    tagFilter={tagFilter}
                                    onTagFilterChange={setTagFilter}
                                    tagScores={tagScores}
                                    onTagScoreChange={(appType, tag, score) => {
                                        setTagScores(prev => ({
                                            ...prev,
                                            [tag]: score
                                        }));
                                        setCustomFormats(prev => {
                                            const newFormats = {...prev};
                                            
                                            // If setting a non-zero score, handle conflicts for all formats with this tag
                                            if (score !== 0) {
                                                if (appType === 'both') {
                                                    // Setting in "both" clears radarr AND sonarr for formats with this tag
                                                    newFormats.radarr = newFormats.radarr.map(format => {
                                                        if (format.tags?.includes(tag)) {
                                                            return {...format, score: 0};
                                                        }
                                                        return format;
                                                    });
                                                    newFormats.sonarr = newFormats.sonarr.map(format => {
                                                        if (format.tags?.includes(tag)) {
                                                            return {...format, score: 0};
                                                        }
                                                        return format;
                                                    });
                                                } else {
                                                    // Setting in radarr/sonarr only clears "both" for formats with this tag
                                                    newFormats.both = newFormats.both.map(format => {
                                                        if (format.tags?.includes(tag)) {
                                                            return {...format, score: 0};
                                                        }
                                                        return format;
                                                    });
                                                }
                                            }
                                            
                                            // Update the target app type
                                            newFormats[appType] = newFormats[appType].map(format => {
                                                if (format.tags?.includes(tag)) {
                                                    return {...format, score};
                                                }
                                                return format;
                                            });
                                            
                                            return newFormats;
                                        });
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
                                    upgradesAllowed={upgradesAllowed}
                                    onUpgradesAllowedChange={setUpgradesAllowed}
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
            language: PropTypes.string
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
