import PropTypes from 'prop-types';
import {useState, useEffect, useRef, useLayoutEffect} from 'react';
import {Link, useLocation} from 'react-router-dom';
import Logo from '@ui/Logo';

function ToggleSwitch({checked, onChange}) {
    return (
        <label className='flex items-center cursor-pointer'>
            <div className='relative'>
                <input
                    type='checkbox'
                    className='sr-only'
                    checked={checked}
                    onChange={onChange}
                />
                <div
                    className={`block w-14 h-8 rounded-full ${
                        checked ? 'bg-blue-600' : 'bg-gray-600'
                    } transition-colors duration-300`}></div>
                <div
                    className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${
                        checked ? 'transform translate-x-6' : ''
                    }`}></div>
            </div>
            <div className='ml-3 text-gray-300 font-medium'>
                {checked ? 'Dark' : 'Light'}
            </div>
        </label>
    );
}

ToggleSwitch.propTypes = {
    checked: PropTypes.bool.isRequired,
    onChange: PropTypes.func.isRequired
};

function Navbar({darkMode, setDarkMode}) {
    const [tabOffset, setTabOffset] = useState(0);
    const [tabWidth, setTabWidth] = useState(0);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const tabsRef = useRef({});
    const location = useLocation();
    const [isInitialized, setIsInitialized] = useState(false);

    const getActiveTab = pathname => {
        if (pathname === '/' || pathname === '') return 'settings';
        if (pathname.startsWith('/regex')) return 'regex';
        if (pathname.startsWith('/format')) return 'format';
        if (pathname.startsWith('/profile')) return 'profile';
        if (pathname.startsWith('/media-management')) return 'media-management';
        if (pathname.startsWith('/settings')) return 'settings';
        return 'settings';
    };

    const activeTab = getActiveTab(location.pathname);

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

    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location]);

    return (
        <nav className='bg-gradient-to-br from-gray-800 to-gray-900 border-b border-gray-700 shadow-xl backdrop-blur-sm'>
            <div className='max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 relative'>
                <div className='flex items-center justify-between h-16'>
                    <div className='flex items-center flex-1'>
                        <div className='flex items-center gap-3'>
                            <Logo className='h-10 w-10' />
                            <h1 className='text-2xl font-bold text-white'>
                                profilarr
                            </h1>
                        </div>
                        <div className='hidden lg:flex relative space-x-2 ml-8'>
                            {isInitialized && (
                                <div
                                    className='absolute top-0 bottom-0 bg-gray-900 rounded-md transition-all duration-300'
                                    style={{
                                        left: `${tabOffset}px`,
                                        width: `${tabWidth}px`
                                    }}></div>
                            )}
                            <Link
                                to='/regex'
                                ref={el => (tabsRef.current['regex'] = el)}
                                className={`px-3 py-2 rounded-md text-sm font-medium relative z-10 ${
                                    activeTab === 'regex'
                                        ? 'text-white'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}>
                                Regex Patterns
                            </Link>
                            <Link
                                to='/format'
                                ref={el => (tabsRef.current['format'] = el)}
                                className={`px-3 py-2 rounded-md text-sm font-medium relative z-10 ${
                                    activeTab === 'format'
                                        ? 'text-white'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}>
                                Custom Formats
                            </Link>
                            <Link
                                to='/profile'
                                ref={el => (tabsRef.current['profile'] = el)}
                                className={`px-3 py-2 rounded-md text-sm font-medium relative z-10 ${
                                    activeTab === 'profile'
                                        ? 'text-white'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}>
                                Quality Profiles
                            </Link>
                            <Link
                                to='/media-management'
                                ref={el => (tabsRef.current['media-management'] = el)}
                                className={`px-3 py-2 rounded-md text-sm font-medium relative z-10 ${
                                    activeTab === 'media-management'
                                        ? 'text-white'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}>
                                Media Management
                            </Link>
                            <Link
                                to='/settings'
                                ref={el => (tabsRef.current['settings'] = el)}
                                className={`px-3 py-2 rounded-md text-sm font-medium relative z-10 ${
                                    activeTab === 'settings'
                                        ? 'text-white'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}>
                                Settings
                            </Link>
                        </div>
                    </div>
                    <div className='hidden lg:block'>
                        <ToggleSwitch
                            checked={darkMode}
                            onChange={() => setDarkMode(!darkMode)}
                        />
                    </div>
                    <button
                        className='lg:hidden p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white'
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                        <span className='sr-only'>Open main menu</span>
                        {isMobileMenuOpen ? (
                            <svg className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                            </svg>
                        ) : (
                            <svg className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
                            </svg>
                        )}
                    </button>
                </div>
                {isMobileMenuOpen && (
                    <div className='lg:hidden absolute top-16 left-0 right-0 bg-gray-800 border-b border-gray-700 shadow-lg z-50'>
                        <div className='px-2 pt-2 pb-3 space-y-1'>
                            <Link
                                to='/regex'
                                className={`block px-3 py-2 rounded-md text-base font-medium ${
                                    activeTab === 'regex'
                                        ? 'text-white bg-gray-900'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}>
                                Regex Patterns
                            </Link>
                            <Link
                                to='/format'
                                className={`block px-3 py-2 rounded-md text-base font-medium ${
                                    activeTab === 'format'
                                        ? 'text-white bg-gray-900'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}>
                                Custom Formats
                            </Link>
                            <Link
                                to='/profile'
                                className={`block px-3 py-2 rounded-md text-base font-medium ${
                                    activeTab === 'profile'
                                        ? 'text-white bg-gray-900'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}>
                                Quality Profiles
                            </Link>
                            <Link
                                to='/media-management'
                                className={`block px-3 py-2 rounded-md text-base font-medium ${
                                    activeTab === 'media-management'
                                        ? 'text-white bg-gray-900'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}>
                                Media Management
                            </Link>
                            <Link
                                to='/settings'
                                className={`block px-3 py-2 rounded-md text-base font-medium ${
                                    activeTab === 'settings'
                                        ? 'text-white bg-gray-900'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}>
                                Settings
                            </Link>
                        </div>
                        <div className='px-4 py-3 border-t border-gray-700'>
                            <ToggleSwitch
                                checked={darkMode}
                                onChange={() => setDarkMode(!darkMode)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}

Navbar.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired
};

export default Navbar;
