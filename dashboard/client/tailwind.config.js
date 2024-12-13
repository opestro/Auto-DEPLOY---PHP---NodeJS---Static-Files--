/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#2997FF',
        secondary: '#A855F7',
        dark: '#000000',
        'dark-accent': '#1D1D1F'
      },
      boxShadow: {
        'apple': '0 20px 48px rgba(0, 0, 0, 0.15)',
        'apple-hover': '0 24px 56px rgba(0, 0, 0, 0.2)'
      }
    }
  },
  plugins: [],
}

