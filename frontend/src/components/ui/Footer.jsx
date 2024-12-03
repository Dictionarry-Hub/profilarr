import React from 'react';
import DiscordIcon from '@logo/Discord.svg';
import GithubIcon from '@logo/GitHub.svg';

const Footer = () => {
    return (
        <footer className='bg-gray-800 w-full mt-4'>
            <div className='max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8'>
                <div className='flex justify-end items-center h-12'>
                    <div className='flex items-center space-x-6'>
                        <a
                            href='https://discord.com/invite/Y9TYP6jeYZ'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='group relative p-3 transition-all duration-500 hover:scale-150'>
                            <img
                                src={DiscordIcon}
                                alt='Discord'
                                className='w-5 h-5 filter invert relative z-10 transition-all duration-500 group-hover:rotate-[360deg] group-hover:animate-[pulse_1s_ease-in-out_infinite] group-hover:brightness-75'
                            />
                        </a>
                        <a
                            href='https://github.com/Dictionarry-Hub'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='group relative p-3 transition-all duration-500 hover:scale-150'>
                            <img
                                src={GithubIcon}
                                alt='GitHub'
                                className='w-5 h- filter invert relative z-10 transition-all duration-500 group-hover:rotate-[360deg] group-hover:animate-[pulse_1s_ease-in-out_infinite] group-hover:brightness-75'
                            />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
