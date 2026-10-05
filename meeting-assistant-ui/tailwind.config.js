/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: { 950: '#0d141c', 900: '#16212d', 800: '#243443', 700: '#3a4d5c', 600: '#597182', 500: '#7a93a3', 400: '#a0b3c1', 300: '#bfd0dc', 200: '#d6e3ed', 100: '#e4edf5' },
        indigo: { 950: '#102c2e', 900: '#1d4140', 800: '#245753', 700: '#276b64', 600: '#2e8177', 500: '#4fa89f', 400: '#71cbc0', 300: '#9dded4', 200: '#c3eee7', 100: '#def7f1' },
      },
    },
  },
  plugins: [],
}
