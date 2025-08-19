import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate
} from 'react-router-dom';
import {useState, useEffect} from 'react';
import RegexPage from './components/regex/RegexPage';
import FormatPage from './components/format/FormatPage';
import ProfilePage from './components/profile/ProfilePage';
import SettingsPage from './components/settings/SettingsPage';
import MediaManagementPage from './components/media-management/MediaManagementPage';
import SetupPage from './components/auth/SetupPage';
import LoginPage from './components/auth/LoginPage';
import Navbar from '@ui/Navbar';
import Footer from '@ui/Footer';
import {ToastContainer} from 'react-toastify';
import {checkSetupStatus} from '@api/auth';
import 'react-toastify/dist/ReactToastify.css';
import ErrorBoundary from '@ui/ErrorBoundary';
function App() {
    const [darkMode, setDarkMode] = useState(true);
    const [authState, setAuthState] = useState({
        checking: true,
        needsSetup: false,
        needsLogin: false,
        error: null
    });

    // Prevent layout shifts from scrollbar
    useEffect(() => {
        document.body.style.overflowY = 'scroll';
        return () => {
            document.body.style.overflowY = '';
        };
    }, []);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const status = await checkSetupStatus();
                setAuthState({
                    checking: false,
                    needsSetup: status.needsSetup,
                    needsLogin: status.needsLogin,
                    error: status.error
                });
            } catch (error) {
                setAuthState({
                    checking: false,
                    needsSetup: false,
                    needsLogin: false,
                    error: 'Unable to connect to server'
                });
            }
        };

        checkAuth();
    }, []);

    if (authState.checking) {
        return (
            <>
                <div>Loading...</div>
                <ToastContainer
                    position='top-right'
                    autoClose={5000}
                    hideProgressBar={false}
                    newestOnTop={false}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme='dark'
                />
            </>
        );
    }

    if (authState.needsSetup) {
        return (
            <>
                <SetupPage
                    onSetupComplete={() =>
                        setAuthState({
                            ...authState,
                            needsSetup: false,
                            needsLogin: false
                        })
                    }
                />
                <ToastContainer
                    position='top-right'
                    autoClose={5000}
                    hideProgressBar={false}
                    newestOnTop={false}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme='dark'
                />
            </>
        );
    }

    if (authState.needsLogin) {
        return (
            <>
                <LoginPage
                    onLoginComplete={() =>
                        setAuthState({...authState, needsLogin: false})
                    }
                />
                <ToastContainer
                    position='top-right'
                    autoClose={5000}
                    hideProgressBar={false}
                    newestOnTop={false}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme='dark'
                />
            </>
        );
    }

    return (
        <>
            <Router>
                <ErrorBoundary>
                    <div className='min-h-screen flex flex-col bg-gray-900 text-gray-100'>
                        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
                        <div className='max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-2 flex-grow flex-1 w-full'>
                            <Routes>
                                <Route path='/regex' element={<RegexPage />} />
                                <Route
                                    path='/format'
                                    element={<FormatPage />}
                                />
                                <Route
                                    path='/profile'
                                    element={<ProfilePage />}
                                />
                                <Route
                                    path='/media-management'
                                    element={<MediaManagementPage />}
                                />
                                <Route
                                    path='/settings'
                                    element={<SettingsPage />}
                                />
                                <Route
                                    path='/'
                                    element={<Navigate to='/settings' />}
                                />
                            </Routes>
                        </div>
                        <Footer />
                    </div>
                </ErrorBoundary>
            </Router>
            <ToastContainer
                position='top-right'
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme='dark'
            />
        </>
    );
}
export default App;
