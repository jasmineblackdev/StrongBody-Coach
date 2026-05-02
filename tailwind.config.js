/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0a0c',
          900: '#101013',
          850: '#15151a',
          800: '#1c1c22',
          700: '#26262e',
          600: '#3a3a45',
        },
        accent: {
          DEFAULT: '#f43f7a',
          soft: '#ff7aa6',
          deep: '#c81e5a',
        },
        rose: {
          glow: '#ffd1dc',
        },
        success: '#3fd07a',
        warning: '#ffb547',
        danger: '#ff5a5f',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica', 'Arial'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(244,63,122,0.35), 0 8px 30px -10px rgba(244,63,122,0.45)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
