import React, { useState, useEffect } from 'react';
import { MediaManagement } from '@api/mediaManagement';
import { toast } from 'react-toastify';
import MiscSettings from './MiscSettings';
import NamingSettings from './NamingSettings';
import QualityDefinitions from './QualityDefinitions';

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
            
            toast.success(`${category.replace('_', ' ')} settings saved successfully`);
        } catch (err) {
            console.error(`Error saving ${category}:`, err);
            toast.error(`Failed to save ${category.replace('_', ' ')} settings`);
        } finally {
            setSavingStates(prev => ({ ...prev, [category]: false }));
        }
    };

    const handleSync = (category) => {
        console.log(`Syncing ${activeTab} ${category} from arr instance`);
        // TODO: Implement actual sync logic
        toast.info('Sync functionality coming soon');
    };

    return (
        <div>
            {/* Tab Navigation */}
            <nav className='flex space-x-4 my-4'>
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
            </nav>

            {/* Loading and Error States */}
            {loading && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-gray-400 dark:text-gray-400">Loading media management settings...</p>
                </div>
            )}

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
        </div>
    );
};

export default MediaManagementPage;