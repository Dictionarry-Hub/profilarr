import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Modal from '../ui/Modal';
import { getArrConfigs } from '@api/arr';
import { syncMediaManagement } from '@api/mediaManagement';
import Alert from '@ui/Alert';
import { Loader, RefreshCw, Server, Check } from 'lucide-react';

const SyncModal = ({ isOpen, onClose, arrType, category = null }) => {
    const [arrConfigs, setArrConfigs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedConfigs, setSelectedConfigs] = useState([]);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedConfigs([]); // Reset selection when modal opens
            fetchArrConfigs();
        }
    }, [isOpen, arrType]);

    const fetchArrConfigs = async () => {
        setLoading(true);
        try {
            const response = await getArrConfigs();
            
            // Backend returns { success: true, data: [...configs...] }
            if (response.success && response.data) {
                // Filter configs by the current arr type (radarr or sonarr)
                const filteredConfigs = response.data.filter(config => 
                    config.type.toLowerCase() === arrType.toLowerCase()
                );
                setArrConfigs(filteredConfigs);
            } else {
                console.error('API returned unsuccessful response:', response);
                Alert.error(response.error || 'Failed to load arr configurations');
                setArrConfigs([]);
            }
        } catch (error) {
            console.error('Error fetching arr configs:', error);
            Alert.error('Failed to load arr configurations');
            setArrConfigs([]);
        } finally {
            setLoading(false);
        }
    };

    const handleConfigToggle = (configId) => {
        setSelectedConfigs(prev => 
            prev.includes(configId)
                ? prev.filter(id => id !== configId)
                : [...prev, configId]
        );
    };

    const handleSelectAll = () => {
        if (selectedConfigs.length === arrConfigs.length) {
            setSelectedConfigs([]);
        } else {
            setSelectedConfigs(arrConfigs.map(config => config.id));
        }
    };

    const handleSync = async () => {
        if (selectedConfigs.length === 0) {
            Alert.warning('Please select at least one arr instance to sync with');
            return;
        }

        const syncCategories = category ? [category] : ['misc', 'naming', 'quality_definitions'];
        const syncType = category ? `${category} settings` : 'all settings';
        
        setSyncing(true);
        try {
            // Sync to each selected arr instance
            const syncPromises = selectedConfigs.map(async (configId) => {
                try {
                    const result = await syncMediaManagement(configId, syncCategories);
                    return { configId, success: result.success, results: result.results };
                } catch (error) {
                    return { configId, success: false, error: error.message };
                }
            });
            
            const results = await Promise.all(syncPromises);
            
            // Show results
            const successCount = results.filter(r => r.success).length;
            const totalCount = results.length;
            
            if (successCount === totalCount) {
                Alert.success(`Successfully synced ${syncType} to ${successCount} arr instance(s)`);
            } else if (successCount > 0) {
                Alert.warning(`Synced ${syncType} to ${successCount}/${totalCount} arr instances. Check logs for details.`);
            } else {
                Alert.error(`Failed to sync ${syncType} to any arr instances. Check logs for details.`);
            }
            
            console.log('Sync results:', results);
            onClose();
            
        } catch (error) {
            console.error('Error during sync:', error);
            Alert.error('An error occurred during sync');
        } finally {
            setSyncing(false);
        }
    };

    const modalTitle = category 
        ? `Sync ${category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${arrType.charAt(0).toUpperCase() + arrType.slice(1)}`
        : `Sync All Settings - ${arrType.charAt(0).toUpperCase() + arrType.slice(1)}`;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            width="xl"
            footer={
                <div className="flex justify-end">
                    <button
                        onClick={handleSync}
                        disabled={selectedConfigs.length === 0 || syncing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-700/50 border border-gray-700 text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        {syncing ? (
                            <Check className="w-4 h-4 text-green-500" />
                        ) : (
                            <RefreshCw className="w-4 h-4 text-blue-500" />
                        )}
                        <span>Sync</span>
                    </button>
                </div>
            }
        >
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="ml-2">Loading...</span>
                </div>
            ) : arrConfigs.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-600">No {arrType} instances configured</p>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-800/50 border-b border-gray-700">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Name</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Tags</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-300">Select</th>
                            </tr>
                        </thead>
                        <tbody>
                            {arrConfigs.map((config, index) => (
                                <tr
                                    key={config.id}
                                    className={`cursor-pointer select-none transition-colors hover:bg-gray-700/50 ${index !== arrConfigs.length - 1 ? 'border-b border-gray-700/50' : ''}`}
                                    onClick={() => handleConfigToggle(config.id)}
                                >
                                    <td className="py-3 px-4">
                                        <span className="font-medium text-gray-200">{config.name}</span>
                                    </td>
                                    <td className="py-3 px-4">
                                        {config.tags && config.tags.length > 0 ? (
                                            <div className="flex gap-2 flex-wrap">
                                                {config.tags.map(tag => (
                                                    <span 
                                                        key={tag} 
                                                        className="inline-block px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 rounded-full text-xs font-medium text-gray-200"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-500">—</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex justify-end">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                                                selectedConfigs.includes(config.id)
                                                    ? 'bg-blue-500'
                                                    : 'bg-gray-700 hover:bg-gray-600'
                                            }`}>
                                                {selectedConfigs.includes(config.id) && (
                                                    <Check size={14} className="text-white" />
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Modal>
    );
};

SyncModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    arrType: PropTypes.oneOf(['radarr', 'sonarr']).isRequired,
    category: PropTypes.string // null for sync all, or specific category name
};

export default SyncModal;