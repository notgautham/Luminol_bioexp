/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        surface: {
          0: '#0a0e17',
          1: '#0f1420',
          2: '#151b2b',
          3: '#1c2438',
          4: '#232d45',
        },
        accent: {
          DEFAULT: '#3b82f6',
          dim: '#2563eb',
          glow: '#60a5fa',
          muted: '#1e3a5f',
          surface: 'rgba(59, 130, 246, 0.08)',
        },
        danger: {
          DEFAULT: '#ef4444',
          dim: '#dc2626',
          surface: 'rgba(239, 68, 68, 0.08)',
        },
        success: {
          DEFAULT: '#22c55e',
          dim: '#16a34a',
          surface: 'rgba(34, 197, 94, 0.08)',
        },
        warn: {
          DEFAULT: '#f59e0b',
          surface: 'rgba(245, 158, 11, 0.08)',
        },
        muted: {
          DEFAULT: '#64748b',
          dim: '#475569',
          faint: '#334155',
        },
        border: {
          DEFAULT: '#1e293b',
          hover: '#334155',
          accent: 'rgba(59, 130, 246, 0.25)',
        },
      },
      borderRadius: {
        card: '10px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        elevated: '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
        glow: '0 0 20px rgba(59, 130, 246, 0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'progress': 'progress-indeterminate 1.5s ease-in-out infinite',
      },
      keyframes: {
        'progress-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
    },
  },
  plugins: [],
}
