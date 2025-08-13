import React, {useRef, useState, useEffect, useLayoutEffect, useCallback} from 'react';

const TabViewer = ({tabs, activeTab, onTabChange}) => {
    const [tabOffset, setTabOffset] = useState(0);
    const [tabWidth, setTabWidth] = useState(0);
    const tabsRef = useRef({});
    const [isInitialized, setIsInitialized] = useState(false);
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768;
        }
        return false;
    });
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const updateTabPosition = useCallback(() => {
        if (tabsRef.current[activeTab]) {
            const tab = tabsRef.current[activeTab];
            // Use requestAnimationFrame to ensure smooth animation
            requestAnimationFrame(() => {
                setTabOffset(tab.offsetLeft);
                setTabWidth(tab.offsetWidth);
                if (!isInitialized) {
                    setIsInitialized(true);
                }
            });
        }
    }, [activeTab, isInitialized]);

    useLayoutEffect(() => {
        // Immediate update for position
        updateTabPosition();
    }, [activeTab, updateTabPosition]);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(updateTabPosition);
        if (tabsRef.current[activeTab]) {
            resizeObserver.observe(tabsRef.current[activeTab]);
        }
        return () => resizeObserver.disconnect();
    }, [activeTab, updateTabPosition]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        setIsDropdownOpen(false);
    }, [activeTab]);

    if (!tabs?.length) return null;

    const activeTabLabel = tabs.find(tab => tab.id === activeTab)?.label || '';

    if (isMobile) {
        return (
            <div className='relative'>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className='flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors'>
                    {activeTabLabel}
                    <svg className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                    </svg>
                </button>
                {isDropdownOpen && (
                    <div className='absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50'>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    onTabChange(tab.id);
                                    setIsDropdownOpen(false);
                                }}
                                className={`block w-full text-left px-4 py-2 text-sm font-medium transition-colors
                                    ${
                                        activeTab === tab.id
                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className='relative flex items-center'>
            {isInitialized && (
                <div
                    className='absolute top-0 bottom-0 bg-gray-900 dark:bg-gray-900 rounded-md transition-all duration-300 ease-out will-change-transform'
                    style={{
                        transform: `translateX(${tabOffset}px)`,
                        width: `${tabWidth}px`
                    }}
                />
            )}
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    ref={el => (tabsRef.current[tab.id] = el)}
                    onClick={() => onTabChange(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium relative z-10 transition-colors
            ${
                activeTab === tab.id
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}>
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

export default TabViewer;