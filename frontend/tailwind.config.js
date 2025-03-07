/** @type {import('tailwindcss').Config} */
// tailwind.config.js
module.exports = {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                code: ['Courier New', 'monospace'] // Custom pre font
            },
            keyframes: {
                'modal-open': {
                    '0%': {opacity: 0, transform: 'scale(0.95)'},
                    '100%': {opacity: 1, transform: 'scale(1)'}
                },
                'fade-in': {
                    '0%': {opacity: 0},
                    '100%': {opacity: 1}
                },
                'slide-down': {
                    '0%': {
                        opacity: '0',
                        transform: 'translateY(-80px)'
                    },
                    '100%': {
                        opacity: '1',
                        transform: 'translateY(0)'
                    }
                },
                'slide-up': {
                    '0%': {
                        opacity: '1',
                        transform: 'translateY(0)'
                    },
                    '100%': {
                        opacity: '0',
                        transform: 'translateY(80px)'
                    }
                },
                wiggle: {
                    '0%, 100%': {transform: 'rotate(0deg)'},
                    '25%': {transform: 'rotate(-20deg)'},
                    '75%': {transform: 'rotate(20deg)'}
                },
                'check-bounce': {
                    '0%, 100%': {transform: 'scale(1) rotate(0deg)'},
                    '30%': {transform: 'scale(1.15) rotate(-10deg)'},
                    '60%': {transform: 'scale(0.9) rotate(5deg)'}
                },
                'eye-blink': {
                    '0%, 100%': {transform: 'scale(1)', opacity: 1},
                    '50%': {transform: 'scale(1.2)', opacity: 0.8}
                },
                'modal-in': {
                    '0%': { 
                        opacity: '0',
                        transform: 'translateY(20px) scale(0.97)'
                    },
                    '60%': {
                        opacity: '1',
                        transform: 'translateY(-3px) scale(1.01)'
                    },
                    '100%': {
                        opacity: '1',
                        transform: 'translateY(0) scale(1)'
                    }
                },
                'modal-out': {
                    '0%': {
                        opacity: '1',
                        transform: 'translateY(0) scale(1)'
                    },
                    '100%': {
                        opacity: '0',
                        transform: 'translateY(20px) scale(0.97)'
                    }
                }
            },
            animation: {
                'modal-open': 'modal-open 0.3s ease-out forwards',
                'fade-in': 'fade-in 0.5s ease-in-out forwards',
                'slide-down': 'slide-down 0.2s ease-out',
                'slide-up': 'slide-up 0.2s ease-in forwards',
                wiggle: 'wiggle 0.3s ease-in-out',
                'check-bounce': 'check-bounce 0.3s ease-in-out',
                'eye-blink': 'eye-blink 0.5s ease-in-out',
                'modal-in': 'modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'modal-out': 'modal-out 0.15s ease-in-out forwards'
            },
            colors: {
                'dark-bg': '#1a1c23',
                'dark-card': '#2a2e37',
                'dark-text': '#e2e8f0',
                'dark-border': '#4a5568',
                'dark-button': '#3182ce',
                'dark-button-hover': '#2c5282'
            },
            borderRadius: {
                lg: '0.5rem',
                md: '0.375rem',
                sm: '0.25rem'
            }
        }
    },
    plugins: []
};
