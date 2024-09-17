import React from 'react';
import PropTypes from 'prop-types';

function AddNewCard({onAdd, width, height, minHeight}) {
    const style = {
        width: width || '100%',
        height: height || 'auto',
        minHeight: minHeight || '150px'
    };

    return (
        <div
            className='bg-white dark:bg-gray-800 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg p-4 shadow-sm cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 flex items-center justify-center'
            onClick={onAdd}
            style={style}>
            <span className='text-4xl text-gray-400 dark:text-gray-500'>+</span>
        </div>
    );
}

AddNewCard.propTypes = {
    onAdd: PropTypes.func.isRequired,
    width: PropTypes.string,
    height: PropTypes.string,
    minHeight: PropTypes.string
};

export default AddNewCard;
