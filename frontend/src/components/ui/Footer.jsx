import React, {useState, useEffect} from 'react';
import DiscordIcon from '@logo/Discord.svg';
import GithubIcon from '@logo/GitHub.svg';
import {BookOpen, Bug, Star, CircleDot} from 'lucide-react';

const Footer = () => {
    const [repoInfo, setRepoInfo] = useState(null);
    const [orgAvatar, setOrgAvatar] = useState(null);

    useEffect(() => {
        const fetchInfo = async () => {
            const repoKey = 'github-repo-info';
            const avatarKey = 'github-org-avatar';
            const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

            const cachedRepo = localStorage.getItem(repoKey);
            const cachedAvatar = localStorage.getItem(avatarKey);
            const repoTimestamp = localStorage.getItem(`${repoKey}-timestamp`);
            const avatarTimestamp = localStorage.getItem(
                `${avatarKey}-timestamp`
            );

            const isRepoValid =
                repoTimestamp &&
                Date.now() - parseInt(repoTimestamp) < cacheDuration;
            const isAvatarValid =
                avatarTimestamp &&
                Date.now() - parseInt(avatarTimestamp) < cacheDuration;

            if (cachedRepo && isRepoValid) {
                setRepoInfo(JSON.parse(cachedRepo));
            }
            if (cachedAvatar && isAvatarValid) {
                setOrgAvatar(cachedAvatar);
            }

            if (!isRepoValid || !isAvatarValid) {
                try {
                    const [repoResponse, releaseResponse, orgResponse] =
                        await Promise.all([
                            fetch(
                                'https://api.github.com/repos/Dictionarry-Hub/profilarr'
                            ),
                            fetch(
                                'https://api.github.com/repos/Dictionarry-Hub/profilarr/releases/latest'
                            ),
                            fetch('https://api.github.com/orgs/Dictionarry-Hub')
                        ]);

                    if (
                        repoResponse.ok &&
                        releaseResponse.ok &&
                        orgResponse.ok
                    ) {
                        const [repoData, releaseData, orgData] =
                            await Promise.all([
                                repoResponse.json(),
                                releaseResponse.json(),
                                orgResponse.json()
                            ]);

                        const info = {
                            stars: repoData.stargazers_count,
                            version: releaseData.tag_name,
                            issues: repoData.open_issues_count
                        };

                        localStorage.setItem(repoKey, JSON.stringify(info));
                        localStorage.setItem(
                            `${repoKey}-timestamp`,
                            Date.now().toString()
                        );
                        setRepoInfo(info);

                        localStorage.setItem(avatarKey, orgData.avatar_url);
                        localStorage.setItem(
                            `${avatarKey}-timestamp`,
                            Date.now().toString()
                        );
                        setOrgAvatar(orgData.avatar_url);
                    }
                } catch (error) {
                    console.error('Error fetching GitHub data:', error);
                }
            }
        };

        fetchInfo();
    }, []);

    return (
        <footer className='bg-gray-800 w-full mt-4'>
            <div className='max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8'>
                <div className='flex justify-between items-center h-16'>
                    {/* Left side */}
                    <div className='flex items-center space-x-8'>
                        {/* Repo Info */}
                        <div className='flex items-center space-x-3'>
                            {orgAvatar && (
                                <img
                                    src={orgAvatar}
                                    alt='Organization'
                                    className='w-8 h-8 rounded-md'
                                />
                            )}
                            <div className='flex flex-col justify-center'>
                                <a
                                    href='https://github.com/Dictionarry-Hub/profilarr'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-gray-300 hover:text-gray-100 transition-all duration-200 ease-in-out transform hover:scale-[1.02] text-sm'>
                                    Dictionarry • Profilarr
                                </a>
                                {repoInfo && (
                                    <div className='flex items-center mt-1 text-xs text-gray-400'>
                                        <div
                                            className='flex items-center'
                                            style={{width: '33%'}}>
                                            <Star size={12} className='mr-1' />
                                            <span>{repoInfo.stars}</span>
                                        </div>
                                        <div
                                            className='flex items-center'
                                            style={{width: '33%'}}>
                                            <CircleDot
                                                size={12}
                                                className='mr-1'
                                            />
                                            <span>{repoInfo.issues}</span>
                                        </div>
                                        <div style={{width: '33%'}}>
                                            {repoInfo.version}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right side - Social Links */}
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
                                className='w-5 h-5 filter invert relative z-10 transition-all duration-500 group-hover:rotate-[360deg] group-hover:animate-[pulse_1s_ease-in-out_infinite] group-hover:brightness-75'
                            />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
