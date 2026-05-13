/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#E6F1FB', 100: '#B5D4F4', 500: '#378ADD', 600: '#185FA5', 700: '#0C447C' },
        accent: { 500: '#E24B4A' },
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [],
}
