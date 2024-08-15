/** @type {import('tailwindcss').Config} */
// tailwind.config.js
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        'modal-open': {
          '0%': { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
      animation: {
        'modal-open': 'modal-open 0.3s ease-out forwards',
      },
      colors: {
        'dark-bg': '#1a1c23',
        'dark-card': '#2a2e37',
        'dark-text': '#e2e8f0',
        'dark-border': '#4a5568',
        'dark-button': '#3182ce',
        'dark-button-hover': '#2c5282',
      },
    },
  },
  plugins: [],
}