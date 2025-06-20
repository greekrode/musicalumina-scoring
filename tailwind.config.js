/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'piano-cream': '#FFFBEF',
        'piano-gold': '#E2A225',
        'piano-wine': '#491822',
      },
      animation: {
        'scale-up': 'scaleUp 0.3s ease-out',
      },
      keyframes: {
        scaleUp: {
          '0%': { 
            transform: 'scale(0.9)',
            opacity: '0'
          },
          '100%': { 
            transform: 'scale(1)',
            opacity: '1'
          },
        },
      },
    },
  },
  plugins: [],
};
