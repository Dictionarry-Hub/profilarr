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
import SetupPage from './components/auth/SetupPage';
import LoginPage from './components/auth/LoginPage';
import Navbar from '@ui/Navbar';
import Footer from '@ui/Footer';
import {ToastContainer} from 'react-toastify';
import {checkSetupStatus} from '@api/auth';
import 'react-toastify/dist/ReactToastify.css';

function App() {
    const [darkMode, setDarkMode] = useState(true);
    const [authState, setAuthState] = useState({
        checking: true,
        needsSetup: false,
        needsLogin: false,
        error: null
    });

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
                    error: 'Unable to connect to server'
                });
            }
        };

        checkAuth();
    }, []);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

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
                <div className='min-h-screen flex flex-col bg-gray-900 text-gray-100'>
                    <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
                    <div className='max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 flex-grow flex-1 w-full'>
                        <Routes>
                            <Route path='/regex' element={<RegexPage />} />
                            <Route path='/format' element={<FormatPage />} />
                            <Route path='/profile' element={<ProfilePage />} />
                            <Route
                                path='/settings'
                                element={<SettingsPage />}
                            />
                            <Route path='/' element={<SettingsPage />} />
                        </Routes>
                    </div>
                    <Footer />
                </div>
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
