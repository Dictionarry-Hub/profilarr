import React, {useState, useEffect} from 'react';
import {Loader} from 'lucide-react';
import ArrModal from './ArrModal';
import ArrTable from './ArrTable';
import {getArrConfigs, deleteArrConfig} from '@api/arr';
import {toast} from 'react-toastify';

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
            <ArrTable
                arrs={arrs}
                onAddArr={handleAddArr}
                onEditArr={handleEditArr}
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
