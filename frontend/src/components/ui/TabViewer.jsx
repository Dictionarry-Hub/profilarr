import React, {useRef, useState, useEffect, useLayoutEffect} from 'react';

const TabViewer = ({tabs, activeTab, onTabChange}) => {
    const [tabOffset, setTabOffset] = useState(0);
    const [tabWidth, setTabWidth] = useState(0);
    const tabsRef = useRef({});
    const [isInitialized, setIsInitialized] = useState(false);

    const updateTabPosition = () => {
        if (tabsRef.current[activeTab]) {
            const tab = tabsRef.current[activeTab];
            setTabOffset(tab.offsetLeft);
            setTabWidth(tab.offsetWidth);
            if (!isInitialized) {
                setIsInitialized(true);
            }
        }
    };

    useLayoutEffect(() => {
        updateTabPosition();
    }, [activeTab]);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(updateTabPosition);
        if (tabsRef.current[activeTab]) {
            resizeObserver.observe(tabsRef.current[activeTab]);
        }
        return () => resizeObserver.disconnect();
    }, [activeTab]);

    if (!tabs?.length) return null;

    return (
        <div className='relative flex items-center'>
            {isInitialized && (
                <div
                    className='absolute top-0 bottom-0 bg-gray-900 dark:bg-gray-900 rounded-md transition-all duration-300'
                    style={{
                        left: `${tabOffset}px`,
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
