import React, {useState, useEffect, useCallback} from 'react';

const Logo = ({className}) => {
    const [sliders, setSliders] = useState([
        {width: 70, isAnimating: false},
        {width: 30, isAnimating: false},
        {width: 100, isAnimating: false},
        {width: 50, isAnimating: false},
        {width: 80, isAnimating: false}
    ]);

    const [isHovered, setIsHovered] = useState(false);
    const [animationTimeout, setAnimationTimeout] = useState(null);

    const getRandomWidth = () => {
        return 20 + Math.random() * 80;
    };

    const getRandomSliderIndex = () => {
        const index = Math.floor(Math.random() * 4);
        return index >= 2 ? index + 1 : index;
    };

    const animateRandomSlider = useCallback(() => {
        if (!isHovered) return;

        const index = getRandomSliderIndex();

        setSliders(prev =>
            prev.map((slider, i) => ({
                ...slider,
                isAnimating: i === index
            }))
        );

        setTimeout(() => {
            setSliders(prev =>
                prev.map((slider, i) => {
                    if (i === index) {
                        return {
                            width: getRandomWidth(),
                            isAnimating: false
                        };
                    }
                    return slider;
                })
            );

            const nextTimeout = setTimeout(animateRandomSlider, 800);
            setAnimationTimeout(nextTimeout);
        }, 400);
    }, [isHovered]);

    useEffect(() => {
        if (isHovered) {
            animateRandomSlider();
        } else if (animationTimeout) {
            clearTimeout(animationTimeout);
        }

        return () => {
            if (animationTimeout) {
                clearTimeout(animationTimeout);
            }
        };
    }, [isHovered, animateRandomSlider, animationTimeout]);

    return (
        <div
            className={`relative cursor-pointer transition-transform duration-300 hover:scale-150 ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}>
            <svg
                viewBox='0 0 100 100'
                className='w-full h-full'
                preserveAspectRatio='xMidYMid meet'>
                <rect
                    x='20'
                    y='20'
                    width='60'
                    height='60'
                    rx='4'
                    fill='#1d3461'
                />

                {sliders.map((slider, index) => {
                    const yOffset = 27 + index * 10;
                    return (
                        <g key={index}>
                            <rect
                                x='27'
                                y={yOffset}
                                width={slider.width * 0.45}
                                height='5'
                                rx='2.5'
                                fill='#2d4b83'
                                style={{
                                    transition: 'all 300ms',
                                    transitionTimingFunction: slider.isAnimating
                                        ? 'ease-in-out'
                                        : 'ease-out'
                                }}
                            />
                            <circle
                                cx={27 + slider.width * 0.45}
                                cy={yOffset + 2.5}
                                r='3'
                                fill='white'
                                style={{
                                    transition: 'all 300ms',
                                    transitionTimingFunction: slider.isAnimating
                                        ? 'ease-in-out'
                                        : 'ease-out'
                                }}
                            />
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

export default Logo;
