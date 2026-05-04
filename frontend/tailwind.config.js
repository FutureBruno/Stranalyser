/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        strava: {
          orange: '#FC4C02',
          dark: '#1a1a2e',
        },
      },
    },
  },
  plugins: [],
}
