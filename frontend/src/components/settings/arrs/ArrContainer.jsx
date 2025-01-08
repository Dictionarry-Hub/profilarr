import React, {useState, useEffect} from 'react';
import {Loader} from 'lucide-react';
import ArrModal from './ArrModal';
import ArrCard from './ArrCard';
import AddButton from '@ui/DataBar/AddButton';
import {getArrConfigs} from '@api/arr';

const ArrContainer = () => {
    const [showModal, setShowModal] = useState(false);
    const [editingArr, setEditingArr] = useState(null);
    const [arrs, setArrs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchArrs = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getArrConfigs();
            if (response.success && Array.isArray(response.data)) {
                setArrs(response.data);
            } else {
                setArrs([]);
                setError(
                    response.error || 'Failed to fetch Arr configurations'
                );
            }
        } catch (error) {
            console.error('Error fetching Arr configs:', error);
            setArrs([]);
            setError('An error occurred while fetching Arr configurations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchArrs();
    }, []);

    const handleAddArr = () => {
        setEditingArr(null);
        setShowModal(true);
    };

    const handleEditArr = arr => {
        setEditingArr(arr);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingArr(null);
    };

    const handleModalSubmit = () => {
        fetchArrs();
        handleCloseModal();
    };

    if (loading) {
        return (
            <div className='flex items-center justify-center h-32'>
                <Loader className='w-6 h-6 animate-spin text-blue-500' />
            </div>
        );
    }

    return (
        <div className='space-y-4'>
            {error && (
                <div className='text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-sm'>
                    {error}
                </div>
            )}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'>
                {arrs.map(arrConfig => (
                    <ArrCard
                        key={arrConfig.id}
                        title={arrConfig.name}
                        type={arrConfig.type}
                        sync_method={arrConfig.sync_method}
                        sync_interval={arrConfig.sync_interval}
                        sync_percentage={arrConfig.sync_percentage}
                        last_sync_time={arrConfig.last_sync_time}
                        tags={arrConfig.tags}
                        data_to_sync={arrConfig.data_to_sync}
                        import_as_unique={arrConfig.import_as_unique}
                        onClick={() => handleEditArr(arrConfig)}
                    />
                ))}
            </div>

            <AddButton
                onClick={handleAddArr}
                label='Add New App'
                top='5vh'
                left='75vw'
            />

            <ArrModal
                isOpen={showModal}
                onClose={handleCloseModal}
                onSubmit={handleModalSubmit}
                editingArr={editingArr}
            />
        </div>
    );
};

export default ArrContainer;
