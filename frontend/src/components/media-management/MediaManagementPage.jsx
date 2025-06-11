import React, { useState, useEffect } from 'react';
import { MediaManagement } from '@api/mediaManagement';

const MediaManagementPage = () => {
    const [activeTab, setActiveTab] = useState('radarr');
    const [mediaData, setMediaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    return (
        <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-gray-100 mb-6">Media Management</h1>
            
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

            {/* Tab Content */}
            {loading && <div>Loading...</div>}
            {error && <div>Error: {error}</div>}
            
            {!loading && !error && mediaData && (
                <>
                    {activeTab === 'radarr' && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Radarr Settings</h2>
                            
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold mb-2">Misc</h3>
                                <pre className="bg-gray-800 p-4 rounded">
                                    {JSON.stringify(mediaData.radarr?.misc, null, 2)}
                                </pre>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-lg font-semibold mb-2">Naming</h3>
                                <pre className="bg-gray-800 p-4 rounded">
                                    {JSON.stringify(mediaData.radarr?.naming, null, 2)}
                                </pre>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-lg font-semibold mb-2">Quality Definitions</h3>
                                <pre className="bg-gray-800 p-4 rounded">
                                    {JSON.stringify(mediaData.radarr?.quality_definitions, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sonarr' && (
                        <div>
                            <h2 className="text-xl font-bold mb-4">Sonarr Settings</h2>
                            
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold mb-2">Misc</h3>
                                <pre className="bg-gray-800 p-4 rounded">
                                    {JSON.stringify(mediaData.sonarr?.misc, null, 2)}
                                </pre>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-lg font-semibold mb-2">Naming</h3>
                                <pre className="bg-gray-800 p-4 rounded">
                                    {JSON.stringify(mediaData.sonarr?.naming, null, 2)}
                                </pre>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-lg font-semibold mb-2">Quality Definitions</h3>
                                <pre className="bg-gray-800 p-4 rounded">
                                    {JSON.stringify(mediaData.sonarr?.quality_definitions, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MediaManagementPage;