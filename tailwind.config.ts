import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cb: {
          bg: 'var(--bg)',
          'bg-elevated': 'var(--bg-elevated)',
          surface: 'var(--surface)',
          'surface-hover': 'var(--surface-hover)',
          border: 'var(--border)',
          text: 'var(--text)',
          'text-secondary': 'var(--text-secondary)',
          'text-tertiary': 'var(--text-tertiary)',
          blue: 'var(--blue)',
          'blue-light': 'var(--blue-light)',
          'blue-hover': 'var(--blue-hover)',
          green: 'var(--green)',
          yellow: 'var(--yellow)',
          red: 'var(--red)'
        }
      },
      boxShadow: {
        cb: 'var(--shadow)',
        'cb-md': 'var(--shadow-md)',
        'cb-lg': 'var(--shadow-lg)'
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px'
      },
      animation: {
        'breath': 'breath 2s ease-in-out infinite',
        'bounce-active': 'bounce-active 0.8s ease-in-out infinite',
        'spin-glow': 'spin-glow 1.5s ease-in-out infinite',
        'pulse-beat': 'pulse-beat 0.8s ease-in-out infinite',
        'shake': 'shake 0.4s ease-in-out infinite'
      },
      keyframes: {
        breath: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.12)', opacity: '0.8' }
        },
        'bounce-active': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' }
        },
        'spin-glow': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)', filter: 'brightness(1)' },
          '50%': { transform: 'scale(1.1) rotate(180deg)', filter: 'brightness(1.3)' }
        },
        'pulse-beat': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' }
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' }
        }
      }
    }
  },
  plugins: [],
  corePlugins: {
    preflight: false
  }
} satisfies Config
