/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a1a2e',
          foreground: '#ffffff',
        },
        success: '#16a34a',
      },
    },
  },
  plugins: [],
}
