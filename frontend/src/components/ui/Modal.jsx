import React, {useEffect, useRef} from 'react';
import PropTypes from 'prop-types';

function Modal({
    isOpen,
    onClose,
    title,
    children,
    level = 0,
    disableCloseOnOutsideClick = false,
    disableCloseOnEscape = false,
    width = 'auto',
    height = 'auto',
    maxHeight = '80vh'
}) {
    const modalRef = useRef();

    useEffect(() => {
        if (isOpen && !disableCloseOnEscape) {
            const handleEscape = event => {
                if (event.key === 'Escape') {
                    onClose();
                }
            };
            document.addEventListener('keydown', handleEscape);
            return () => {
                document.removeEventListener('keydown', handleEscape);
            };
        }
    }, [isOpen, onClose, disableCloseOnEscape]);

    const handleClickOutside = e => {
        if (
            modalRef.current &&
            !modalRef.current.contains(e.target) &&
            !disableCloseOnOutsideClick
        ) {
            onClose();
        }
    };

    const widthClasses = {
        auto: 'w-auto max-w-[60%]',
        sm: 'w-[384px]', // 24rem
        md: 'w-[448px]', // 28rem
        lg: 'w-[512px]', // 32rem
        xl: 'w-[576px]', // 36rem
        '2xl': 'w-[672px]', // 42rem
        '3xl': 'w-[768px]', // 48rem
        '4xl': 'w-[896px]', // 56rem
        '5xl': 'w-[1024px]', // 64rem
        '6xl': 'w-[1152px]', // 72rem
        '7xl': 'w-[1280px]', // 80rem
        full: 'w-full',
        'screen-sm': 'w-screen-sm',
        'screen-md': 'w-screen-md',
        'screen-lg': 'w-screen-lg',
        'screen-xl': 'w-screen-xl',
        'screen-2xl': 'w-screen-2xl'
    };

    const heightClasses = {
        auto: 'h-auto',
        sm: 'h-[384px]', // 24rem
        md: 'h-[448px]', // 28rem
        lg: 'h-[512px]', // 32rem
        xl: 'h-[576px]', // 36rem
        '2xl': 'h-[672px]', // 42rem
        '3xl': 'h-[768px]', // 48rem
        '4xl': 'h-[896px]', // 56rem
        '5xl': 'h-[1024px]', // 64rem
        '6xl': 'h-[1152px]', // 72rem
        full: 'h-full'
    };

    return (
        <div
            className={`fixed inset-0 overflow-y-auto h-full w-full flex items-center justify-center transition-opacity duration-300 ease-out scrollable ${
                isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{zIndex: 1000 + level * 10}}
            onClick={handleClickOutside}>
            <div
                className={`fixed inset-0 bg-black transition-opacity duration-300 ease-out ${
                    isOpen ? 'bg-opacity-50' : 'bg-opacity-0'
                }`}
                style={{zIndex: 1000 + level * 10}}></div>
            <div
                ref={modalRef}
                className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-xl 
                min-w-[320px] min-h-[200px] ${widthClasses[width]} ${
                    heightClasses[height]
                } 
                transition-all duration-300 ease-out transform 
                ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} 
                overflow-visible`}
                style={{
                    zIndex: 1001 + level * 10,
                    maxHeight: maxHeight || '80vh'
                }}
                onClick={e => e.stopPropagation()}>
                <div className='flex justify-between items-center px-6 py-4 pb-3 border-b border-gray-300 dark:border-gray-700'>
                    <h3 className='text-xl font-semibold dark:text-gray-200'>
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className='text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors'>
                        <svg
                            className='w-6 h-6'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                            xmlns='http://www.w3.org/2000/svg'>
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='2'
                                d='M6 18L18 6M6 6l12 12'></path>
                        </svg>
                    </button>
                </div>
                <div className='p-6'>{children}</div>
            </div>
        </div>
    );
}

Modal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    level: PropTypes.number,
    disableCloseOnOutsideClick: PropTypes.bool,
    disableCloseOnEscape: PropTypes.bool,
    width: PropTypes.oneOf([
        'auto',
        'sm',
        'md',
        'lg',
        'xl',
        '2xl',
        '3xl',
        '4xl',
        '5xl',
        '6xl',
        '7xl',
        'full',
        'screen',
        'screen-sm',
        'screen-md',
        'screen-lg',
        'screen-xl',
        'screen-2xl'
    ]),
    height: PropTypes.oneOf([
        'auto',
        'sm',
        'md',
        'lg',
        'xl',
        '2xl',
        '3xl',
        '4xl',
        '5xl',
        '6xl',
        'full'
    ]),
    maxHeight: PropTypes.string
};

export default Modal;
