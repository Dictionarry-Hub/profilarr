// ArrContainer.jsx
import React, {useState} from 'react';
import AddNewCard from '../../ui/AddNewCard';
import ArrModal from './ArrModal';

const ArrContainer = () => {
    const [showModal, setShowModal] = useState(false);
    const [editingArr, setEditingArr] = useState(null);

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

    const handleSubmit = arrData => {
        if (editingArr) {
            console.log('Updating arr:', arrData);
            // Implement your update logic here
        } else {
            console.log('Adding new arr:', arrData);
            // Implement your add logic here
        }
        setShowModal(false);
        setEditingArr(null);
    };

    return (
        <>
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4'>
                <AddNewCard
                    onAdd={handleAddArr}
                    width='200px'
                    height='200px'
                    minHeight='200px'
                />
            </div>
            <ArrModal
                isOpen={showModal}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingArr={editingArr}
            />
        </>
    );
};

export default ArrContainer;
