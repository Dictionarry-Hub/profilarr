import React, {useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import TabViewer from './TabViewer';

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    tabs,
    level = 0,
    disableCloseOnOutsideClick = false,
    disableCloseOnEscape = false,
    width = 'auto',
    height = 'auto',
    maxHeight = '90vh'
}) => {
    const modalRef = useRef();
    const [activeTab, setActiveTab] = useState(tabs?.[0]?.id);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsClosing(false);
        }
    }, [isOpen]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 200); // Match animation duration
    };

    useEffect(() => {
        if (isOpen && !disableCloseOnEscape) {
            const handleEscape = event => {
                if (event.key === 'Escape') {
                    handleClose();
                }
            };
            document.addEventListener('keydown', handleEscape);
            return () => {
                document.removeEventListener('keydown', handleEscape);
            };
        }
    }, [isOpen, disableCloseOnEscape]);

    const handleClickOutside = e => {
        // Get the current selection
        const selection = window.getSelection();
        const hasSelection = selection && selection.toString().length > 0;

        if (
            modalRef.current &&
            !modalRef.current.contains(e.target) &&
            !disableCloseOnOutsideClick &&
            !hasSelection && // Don't close if there's text selected
            !isClosing
        ) {
            handleClose();
        }
    };

    const widthClasses = {
        auto: 'w-auto max-w-[60%]',
        sm: 'w-[384px]',
        md: 'w-[448px]',
        lg: 'w-[512px]',
        xl: 'w-[576px]',
        '2xl': 'w-[672px]',
        '3xl': 'w-[768px]',
        '4xl': 'w-[896px]',
        '5xl': 'w-[1024px]',
        '6xl': 'w-[1152px]',
        '7xl': 'w-[1280px]',
        '8xl': 'w-[1408px]',
        '9xl': 'w-[1536px]',
        '10xl': 'w-[1664px]',
        full: 'w-full',
        'screen-sm': 'w-screen-sm',
        'screen-md': 'w-screen-md',
        'screen-lg': 'w-screen-lg',
        'screen-xl': 'w-screen-xl',
        'screen-2xl': 'w-screen-2xl'
    };

    const heightClasses = {
        auto: 'h-auto',
        sm: 'h-[384px]',
        md: 'h-[448px]',
        lg: 'h-[512px]',
        xl: 'h-[576px]',
        '2xl': 'h-[672px]',
        '3xl': 'h-[768px]',
        '4xl': 'h-[896px]',
        '5xl': 'h-[1024px]',
        '6xl': 'h-[1152px]',
        full: 'h-full'
    };

    return (
        <div
            className={`fixed inset-0 overflow-y-auto h-full w-full flex items-center justify-center transition-opacity duration-200 scrollable ${
                isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{zIndex: 1000 + level * 10}}
            onClick={handleClickOutside}>
            <div
                className={`fixed inset-0 bg-black transition-opacity duration-200 ${
                    isOpen ? 'bg-opacity-50' : 'bg-opacity-0'
                }`}
                style={{zIndex: 1000 + level * 10}}
            />
            <div
                ref={modalRef}
                className={`relative bg-gradient-to-br from-gray-50 to-gray-100 
                    dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-xl 
                    min-w-[320px] min-h-[200px] ${widthClasses[width]} ${
                    heightClasses[height]
                } 
                    ${isClosing
                        ? 'animate-slide-up'
                        : isOpen
                            ? 'animate-slide-down' 
                            : 'opacity-0'
                    } 
                    flex flex-col overflow-hidden`}
                style={{
                    zIndex: 1001 + level * 10,
                    maxHeight: maxHeight || '80vh',
                }}
                onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className='flex items-center px-6 py-4 pb-3 border-b border-gray-300 dark:border-gray-700'>
                    <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-200'>
                        {title}
                    </h3>
                    {tabs && (
                        <div className='ml-auto mr-3'>
                            <TabViewer
                                tabs={tabs}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />
                        </div>
                    )}
                    <button
                        onClick={handleClose}
                        className={`${tabs ? '' : 'ml-auto'} text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors`}>
                        <svg
                            className='w-6 h-6'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'>
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='2'
                                d='M6 18L18 6M6 6l12 12'
                            />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className='flex-1 overflow-y-auto p-6 py-4 text-gray-900 dark:text-gray-200'>
                    {typeof children === 'function'
                        ? children(activeTab)
                        : children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className='px-6 py-4 border-t border-gray-300 dark:border-gray-700'>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

Modal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
    footer: PropTypes.node,
    tabs: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired
        })
    ),
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
        '8xl',
        '9xl',
        '10xl',
        'full',
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
