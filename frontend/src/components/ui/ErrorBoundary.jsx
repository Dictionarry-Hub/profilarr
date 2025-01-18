import React from 'react';
import {AlertTriangle, Github, BookOpen} from 'lucide-react';
import DiscordIcon from '@logo/Discord.svg';
import GithubIcon from '@logo/GitHub.svg';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {hasError: false, error: null};
    }

    static getDerivedStateFromError(error) {
        return {hasError: true, error};
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className='min-h-screen bg-gray-900 flex items-center justify-center p-4'>
                    <div className='max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8 text-center border border-gray-700'>
                        <div className='flex justify-center mb-6'>
                            <AlertTriangle className='h-16 w-16 text-red-500' />
                        </div>
                        <h1 className='text-3xl font-bold text-gray-100 mb-4'>
                            Unexpected Error
                        </h1>
                        <p className='text-gray-300 mb-8'>
                            We apologize, but something went wrong while
                            rendering this page.
                        </p>

                        {/* Support links */}
                        <div className='border-t border-gray-700 pt-6'>
                            <p className='text-gray-400 mb-4'>
                                Need help? Reach out to us:
                            </p>
                            <div className='flex justify-center space-x-6'>
                                <a
                                    href='https://discord.com/invite/Y9TYP6jeYZ'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='group relative p-3 transition-all duration-500 hover:scale-125'>
                                    <img
                                        src={DiscordIcon}
                                        alt='Discord'
                                        className='w-6 h-6 filter invert relative z-10 transition-all duration-500 group-hover:rotate-[360deg] group-hover:animate-[pulse_1s_ease-in-out_infinite] group-hover:brightness-75'
                                    />
                                </a>
                                <a
                                    href='https://github.com/Dictionarry-Hub'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='group relative p-3 transition-all duration-500 hover:scale-125'>
                                    <img
                                        src={GithubIcon}
                                        alt='GitHub'
                                        className='w-6 h-6 filter invert relative z-10 transition-all duration-500 group-hover:rotate-[360deg] group-hover:animate-[pulse_1s_ease-in-out_infinite] group-hover:brightness-75'
                                    />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
