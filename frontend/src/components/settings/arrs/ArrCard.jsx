// ArrCard.jsx
import React from 'react';
import PropTypes from 'prop-types';

const ArrCard = ({title, icon: Icon, onClick}) => (
    <div
        className='bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all'
        onClick={onClick}>
        <div className='flex flex-col items-center justify-center h-32'>
            <Icon size={48} className='text-blue-500 mb-2' />
            <h3 className='font-bold text-lg text-gray-800 dark:text-gray-200'>
                {title}
            </h3>
        </div>
    </div>
);

ArrCard.propTypes = {
    title: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    onClick: PropTypes.func.isRequired
};

export default ArrCard;
