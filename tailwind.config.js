/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard"', 'system-ui', 'sans-serif'],
        display: ['"Noto Serif KR"', 'serif'],
      },
      colors: {
        ivory: '#FFFEF9',
        parchment: '#FAF8F2',
        gold: {
          50: '#FAF3E0',
          100: '#F0EBE0',
          200: '#E5DFD1',
          300: '#D4C5A0',
          400: '#B8A88A',
          500: '#A09680',
          600: '#8B6914',
          700: '#5C4A1E',
          800: '#3D3520',
        },
        groom: {
          50: '#F0F4FA',
          100: '#E8F0FE',
          200: '#D6E0F0',
          400: '#6B85AA',
          600: '#2B5EA7',
        },
        bride: {
          50: '#FAF0F0',
          100: '#FDE8E8',
          200: '#F0D6D6',
          400: '#AA6B6B',
          600: '#A72B2B',
        },
      },
    },
  },
  plugins: [],
}
