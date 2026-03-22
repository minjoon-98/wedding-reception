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
        ivory: '#FFFEF7',
        warm: {
          50: '#FFF9F0',
          100: '#FFF3E0',
          200: '#FFE0B2',
          300: '#FFCC80',
          400: '#FFB74D',
          500: '#FF9800',
          600: '#F57C00',
          700: '#E65100',
        },
        sage: {
          50: '#F1F5F0',
          100: '#E0E8DE',
          200: '#C2D1BC',
          300: '#A3BA9A',
          400: '#85A378',
          500: '#6B8F5E',
          600: '#557248',
          700: '#3F5533',
        },
        blush: {
          50: '#FDF2F4',
          100: '#FCE7EB',
          200: '#F9CED6',
          300: '#F4A4B4',
          400: '#EC7A93',
          500: '#E05073',
        },
      },
    },
  },
  plugins: [],
}
