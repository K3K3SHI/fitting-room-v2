import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#181310',
        canvas: '#F7F0E4',
        maroon: '#6E1F2A',
        marigold: '#D89A2C',
        teal: '#0F5257',
        thread: '#C9BBA1'
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)']
      }
    }
  },
  plugins: []
};

export default config;
