import type { Config } from 'tailwindcss';

const color = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: color('ink'),
        paper: {
          DEFAULT: color('paper'),
          hi: color('paper-hi'),
          lo: color('paper-lo'),
        },
        kai: color('kai'),
        isha: color('isha'),
        marker: color('marker'),
        pen: color('red'),
        moss: color('moss'),
      },
      fontFamily: {
        display: ['"Bodoni Moda Variable"', '"Bodoni 72"', 'Didot', 'Georgia', 'serif'],
        sans: [
          '"Hanken Grotesk Variable"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'sans-serif',
        ],
        hand: ['"Reenie Beanie"', '"Bradley Hand"', 'cursive'],
      },
      boxShadow: {
        slip: '0 1px 0 rgb(var(--ink) / 0.07), 0 10px 18px -14px rgb(var(--ink) / 0.5)',
        sheet: '0 2px 0 rgb(var(--ink) / 0.08), 0 24px 48px -20px rgb(var(--ink) / 0.55)',
      },
      keyframes: {
        'rise-in': {
          '0%': { transform: 'translateY(140%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'settle-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) rotate(0.6deg) scale(1.015)' },
          '100%': { opacity: '1', transform: 'translateY(0) rotate(0) scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'drawer-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'bounce-dot': {
          '0%, 70%, 100%': { transform: 'translateY(0)', opacity: '0.45' },
          '35%': { transform: 'translateY(-5px)', opacity: '1' },
        },
        flash: {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--marker) / 0)', backgroundColor: 'rgb(var(--marker) / 0.75)' },
          '100%': { boxShadow: '0 0 0 0 rgb(var(--marker) / 0)', backgroundColor: 'rgb(var(--marker) / 0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-5px)' },
          '40%': { transform: 'translateX(4px)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(2px)' },
        },
        fly: {
          '0%': { transform: 'translate(0, 0)' },
          '45%': { transform: 'translate(5px, -5px)', opacity: '0' },
          '46%': { transform: 'translate(-5px, 5px)', opacity: '0' },
          '100%': { transform: 'translate(0, 0)', opacity: '1' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'settle-in': 'settle-in 0.32s cubic-bezier(0.2, 0.8, 0.3, 1) both',
        'fade-in': 'fade-in 0.2s ease-out both',
        'pop-in': 'pop-in 0.16s ease-out both',
        'drawer-in': 'drawer-in 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'bounce-dot': 'bounce-dot 1.1s ease-in-out infinite',
        flash: 'flash 1.8s ease-out backwards',
        shake: 'shake 0.4s ease-in-out',
        fly: 'fly 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
};

export default config;
