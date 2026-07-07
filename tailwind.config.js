/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/app.jsx', './src/gallito-chat.jsx', './src/offline-card.jsx', './src/data-reference.jsx'],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#FEF3E8', 100: '#FCDDB8', 200: '#F9C080', 300: '#F7A348', 400: '#F57B21', 500: '#D9691A', 600: '#B85714', 700: '#8F430F', 800: '#66300B', 900: '#3D1D06' },
        navy: { 50: '#F0F1F2', 100: '#D5D7DA', 200: '#A9AEB4', 300: '#7D848D', 400: '#515A65', 500: '#3A4149', 600: '#2E3439', 700: '#26282B', 800: '#1A1C1E', 900: '#101112' },
        cream: { 50: '#FDFCFB', 100: '#F3E0C4', 200: '#E8D0A8', 300: '#D4BC94' },
      },
      animation: { 'slide-up': 'slideUp .45s ease-out', 'fade-in': 'fadeIn .35s ease-out', 'scale-in': 'scaleIn .3s ease-out', 'bounce-in': 'bounceIn .5s ease-out' },
      keyframes: {
        slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        bounceIn: { '0%': { opacity: '0', transform: 'scale(.8)' }, '50%': { transform: 'scale(1.05)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
