import React, {useState, useEffect} from 'react';
import ReactDOM from 'react-dom';

const Tooltip = ({content, children}) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [position, setPosition] = useState({x: 0, y: 0});
    const triggerRef = React.useRef(null);

    const updatePosition = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                x: rect.left + rect.width / 2,
                y: rect.top - 10
            });
        }
    };

    useEffect(() => {
        window.addEventListener('scroll', updatePosition);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition);
            window.removeEventListener('resize', updatePosition);
        };
    }, []);

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={() => {
                    updatePosition();
                    setShowTooltip(true);
                }}
                onMouseLeave={() => setShowTooltip(false)}>
                {children}
            </div>
            {showTooltip &&
                ReactDOM.createPortal(
                    <div
                        style={{
                            position: 'fixed',
                            left: `${position.x}px`,
                            top: `${position.y}px`,
                            transform: 'translate(-50%, -100%)',
                            zIndex: 99999
                        }}
                        className='pointer-events-none'>
                        <div className='bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap'>
                            {content}
                            <div className='absolute w-2.5 h-2.5 bg-gray-900 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2' />
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
};

export default Tooltip;
