/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#06070A',
          900: '#0A0C11',
          850: '#0E1017',
          800: '#12151D',
          750: '#171A24',
          700: '#1D212C',
          600: '#2A2F3D',
        },
        brass: {
          50: '#FBF6EC',
          100: '#F5E9D2',
          200: '#EDD8AE',
          300: '#E3C384',
          400: '#D9AE5C',
          500: '#C8963C',
          600: '#A67628',
          700: '#7E581D',
        },
        jade: {
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
        },
        ember: {
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'ui-serif', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -24px rgba(0,0,0,0.9)',
        lift: '0 32px 80px -32px rgba(0,0,0,0.95)',
        glow: '0 0 0 1px rgba(217,174,92,0.28), 0 18px 48px -20px rgba(217,174,92,0.35)',
      },
      backgroundImage: {
        'brass-sheen': 'linear-gradient(135deg,#F5E9D2 0%,#D9AE5C 42%,#A67628 100%)',
        'panel-fade': 'linear-gradient(180deg,rgba(255,255,255,0.045) 0%,rgba(255,255,255,0) 60%)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
        shimmer: { '0%': { backgroundPosition: '-500px 0' }, '100%': { backgroundPosition: '500px 0' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(16,185,129,0.5)' }, '70%': { boxShadow: '0 0 0 8px rgba(16,185,129,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.8s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};
