/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          800: '#111827',
          900: '#0b0f19',
          950: '#070a12',
        },
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#06b6d4',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        emerald: {
          500: '#10b981',
          600: '#059669',
        },
        violet: {
          500: '#8b5cf6',
          600: '#7c3aed',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'gradient-shift': 'gradientShift 6s ease infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite alternate',
        'border-spin': 'borderSpin 4s linear infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glowPulse: {
          '0%': { boxShadow: '0 0 20px rgba(6, 182, 212, 0.25)' },
          '100%': { boxShadow: '0 0 40px rgba(139, 92, 246, 0.55)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      },
      backgroundImage: {
        'grid-pattern': `radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px)`,
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        'neon-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.5)',
        'neon-violet': '0 0 25px -5px rgba(139, 92, 246, 0.5)',
        'neon-gold': '0 0 25px -5px rgba(245, 158, 11, 0.5)',
        'premium': '0 20px 40px -15px rgba(0, 0, 0, 0.35), 0 0 20px rgba(255, 255, 255, 0.05)',
      }
    },
  },
  plugins: [],
}