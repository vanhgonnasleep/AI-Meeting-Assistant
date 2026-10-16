import legacyColors from './src/styles/legacy-colors.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        ...legacyColors,
        canvas: 'rgb(var(--canvas-rgb) / <alpha-value>)',
        indigo: {
          950: '#242c58',
          900: '#333d7c',
          800: '#3e499d',
          700: '#4854b8',
          600: '#535fce',
          500: '#5b68d7',
          400: '#8794ed',
          300: '#aeb8f8',
          200: '#d0d6fc',
          100: '#e6eafd',
          50: '#f0f2ff',
        },
        emerald: {
          950: '#022c22',
          900: '#064e3b',
          800: '#065f46',
          700: '#047857',
          600: '#059669',
          500: '#10b981',
          400: '#34d399',
          300: '#6ee7b7',
          200: '#a7f3d0',
          100: '#d1fae5',
        },
      },
      boxShadow: {
        'glass': '0 12px 44px -18px rgb(65 81 135 / 0.18), inset 0 1px 0 rgb(255 255 255 / 0.9)',
        'panel': '0 6px 22px -10px rgb(65 81 135 / 0.14)',
        'dock': '0 16px 44px -16px rgb(65 81 135 / 0.22), 0 0 0 1px rgb(255 255 255 / 0.8)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ripple': 'ripple 2s cubic-bezier(0, 0.2, 0.8, 1) infinite',
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        ripple: {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
