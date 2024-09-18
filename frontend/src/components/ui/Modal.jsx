import {useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';

function Modal({
    isOpen,
    onClose,
    title,
    children,
    level = 0,
    disableCloseOnOutsideClick = false,
    disableCloseOnEscape = false,
    width = 'lg',
    height = 'auto'
}) {
    const modalRef = useRef();
    const [isAnimating, setIsAnimating] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsClosing(false);
            setShouldRender(true);
            setTimeout(() => setIsAnimating(true), 10);
        } else {
            setIsClosing(true);
            setIsAnimating(false);
            const timer = setTimeout(() => {
                setShouldRender(false);
                setIsClosing(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

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

    if (!shouldRender && !isClosing) return null;

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
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        '6xl': 'max-w-6xl',
        '7xl': 'max-w-7xl',
        full: 'max-w-full',
        screen: 'max-w-screen',
        'screen-sm': 'max-w-screen-sm',
        'screen-md': 'max-w-screen-md',
        'screen-lg': 'max-w-screen-lg',
        'screen-xl': 'max-w-screen-xl',
        'screen-2xl': 'max-w-screen-2xl'
    };

    const heightClasses = {
        auto: 'max-h-screen',
        sm: 'max-h-64',
        md: 'max-h-96',
        lg: 'max-h-128',
        xl: 'max-h-160',
        '2xl': 'max-h-192',
        '3xl': 'max-h-224',
        '4xl': 'max-h-256',
        '5xl': 'max-h-288',
        '6xl': 'max-h-320',
        full: 'max-h-full'
    };

    return (
        <div
            className={`fixed inset-0 overflow-y-auto h-full w-full flex items-center justify-center transition-opacity duration-300 ease-in-out ${
                isAnimating ? 'opacity-100' : 'opacity-0'
            }`}
            style={{zIndex: 1000 + level * 10}}
            onClickCapture={handleClickOutside}>
            <div
                className='fixed inset-0 bg-black bg-opacity-50'
                style={{zIndex: 1000 + level * 10}}></div>
            <div
                ref={modalRef}
                className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full shadow-md ${
                    widthClasses[width]
                } ${
                    heightClasses[height]
                } transform transition-all duration-300 ease-in-out ${
                    isAnimating
                        ? 'translate-y-0 opacity-100'
                        : 'translate-y-10 opacity-0'
                }`}
                style={{
                    zIndex: 1001 + level * 10,
                    overflowY: 'auto'
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
    ])
};

export default Modal;
