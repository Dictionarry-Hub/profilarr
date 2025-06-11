import React, { useState, useEffect } from 'react';
import { MediaManagement } from '@api/mediaManagement';
import Alert from '@ui/Alert';
import { Loader, RefreshCw } from 'lucide-react';
import MiscSettings from './MiscSettings';
import NamingSettings from './NamingSettings';
import QualityDefinitions from './QualityDefinitions';
import SyncModal from './SyncModal';

const loadingMessages = [
    'Configuring media management...',
    'Organizing file naming rules...',
    'Setting up quality definitions...',
    'Preparing media settings...',
    'Loading configuration options...',
    'Initializing management tools...'
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

const MediaManagementPage = () => {
    const [activeTab, setActiveTab] = useState('radarr');
    const [mediaData, setMediaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [savingStates, setSavingStates] = useState({
        misc: false,
        naming: false,
        quality_definitions: false
    });
    const [syncModal, setSyncModal] = useState({
        isOpen: false,
        category: null
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const data = await MediaManagement.getAll();
                setMediaData(data);
            } catch (err) {
                setError(err.message);
                console.error('Error fetching media management data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    const transformDataForSave = (category, data) => {
        // Transform the data back to the format expected by the backend
        if (category === 'misc' || category === 'naming') {
            return {
                radarr: activeTab === 'radarr' ? data : mediaData.radarr[category],
                sonarr: activeTab === 'sonarr' ? data : mediaData.sonarr[category]
            };
        } else if (category === 'quality_definitions') {
            return {
                qualityDefinitions: {
                    radarr: activeTab === 'radarr' ? data : mediaData.radarr.quality_definitions,
                    sonarr: activeTab === 'sonarr' ? data : mediaData.sonarr.quality_definitions
                }
            };
        }
        return data;
    };

    const handleSave = async (category, data) => {
        setSavingStates(prev => ({ ...prev, [category]: true }));
        
        try {
            // Transform data to match backend expectations
            const transformedData = transformDataForSave(category, data);
            
            await MediaManagement.updateCategory(category, transformedData);
            
            // Update local state with new data
            setMediaData(prev => ({
                ...prev,
                [activeTab]: {
                    ...prev[activeTab],
                    [category]: data
                }
            }));
            
            Alert.success(`${category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} settings saved successfully`);
        } catch (err) {
            console.error(`Error saving ${category}:`, err);
            Alert.error(`Failed to save ${category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} settings`);
        } finally {
            setSavingStates(prev => ({ ...prev, [category]: false }));
        }
    };

    const handleSync = (category) => {
        setSyncModal({
            isOpen: true,
            category: category
        });
    };

    const handleSyncAll = () => {
        setSyncModal({
            isOpen: true,
            category: null // null means sync all categories
        });
    };

    const closeSyncModal = () => {
        setSyncModal({
            isOpen: false,
            category: null
        });
    };

    return (
        <div>
            {/* Tab Navigation */}
            <nav className='flex justify-between items-center my-4'>
                <div className='flex space-x-4'>
                    <div
                        onClick={() => handleTabChange('radarr')}
                        className={`cursor-pointer px-3 py-2 rounded-md text-sm font-medium ${
                            activeTab === 'radarr'
                                ? 'bg-gray-600 border border-gray-600 text-white'
                                : 'bg-gray-800 border border-gray-700 text-white'
                        }`}>
                        Radarr
                    </div>
                    <div
                        onClick={() => handleTabChange('sonarr')}
                        className={`cursor-pointer px-3 py-2 rounded-md text-sm font-medium ${
                            activeTab === 'sonarr'
                                ? 'bg-gray-600 border border-gray-600 text-white'
                                : 'bg-gray-800 border border-gray-700 text-white'
                        }`}>
                        Sonarr
                    </div>
                </div>
                <button
                    onClick={handleSyncAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-700/50 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors text-sm"
                >
                    <RefreshCw className="w-4 h-4 text-blue-500" />
                    <span>Sync All</span>
                </button>
            </nav>

            {/* Loading State */}
            {loading && <LoadingState />}

            {error && (
                <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-6">
                    <p className="text-red-400">Error loading settings: {error}</p>
                </div>
            )}

            {/* Content */}
            {!loading && !error && mediaData && (
                <div className="space-y-6">
                    <NamingSettings
                        data={mediaData[activeTab]?.naming}
                        arrType={activeTab}
                        onSave={(data) => handleSave('naming', data)}
                        onSync={() => handleSync('naming')}
                        isSaving={savingStates.naming}
                    />
                    <MiscSettings
                        data={mediaData[activeTab]?.misc}
                        arrType={activeTab}
                        onSave={(data) => handleSave('misc', data)}
                        onSync={() => handleSync('misc')}
                        isSaving={savingStates.misc}
                    />
                    <QualityDefinitions
                        data={mediaData[activeTab]?.quality_definitions}
                        arrType={activeTab}
                        onSave={(data) => handleSave('quality_definitions', data)}
                        onSync={() => handleSync('quality_definitions')}
                        isSaving={savingStates.quality_definitions}
                    />
                </div>
            )}

            {/* Sync Modal */}
            <SyncModal
                isOpen={syncModal.isOpen}
                onClose={closeSyncModal}
                arrType={activeTab}
                category={syncModal.category}
            />
        </div>
    );
};

export default MediaManagementPage;