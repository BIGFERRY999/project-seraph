/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          dark: '#05070c',
          panel: '#080b12',
          card: '#0c1018',
          border: '#1b2333',
          cyan: '#00f0ff',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#ef4444',
        }
      }
    },
  },
  plugins: [],
}
