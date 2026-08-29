/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "surface": "#0b1326",
        "surface-dim": "#0b1326",
        "surface-bright": "#31394d",
        "surface-container-lowest": "#060e20",
        "surface-container-low": "#131b2e",
        "surface-container": "#171f33",
        "surface-container-high": "#222a3d",
        "surface-container-highest": "#2d3449",
        "on-surface": "#dae2fd",
        "on-surface-variant": "#bbc9cd",
        "primary": "#8aebff",
        "primary-container": "#22d3ee",
        "on-primary-container": "#005763",
        "secondary": "#ffb783",
        "secondary-container": "#d97722",
        "on-secondary-container": "#451f00",
        "tertiary": "#66f796",
        "tertiary-container": "#45da7d",
        "error": "#ffb4ab",
        "error-container": "#93000a",
        "outline": "#859397",
        "outline-variant": "#3c494c",
        "surface-tint": "#2fd9f4",
        "command": {
          950: '#060e20',
          900: '#0b1326',
          850: '#131b2e',
          800: '#171f33',
          700: '#222a3d',
          600: '#2d3449',
        },
        "tactical": {
          cyan: '#22d3ee',
          amber: '#fb923c',
          emerald: '#4ade80',
          crimson: '#ef4444',
          slate: '#334155'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-primary': '0 0 15px rgba(47, 217, 244, 0.25)',
        'glow-amber': '0 0 15px rgba(251, 146, 60, 0.25)',
        'glow-emerald': '0 0 15px rgba(74, 222, 128, 0.25)',
        'tactical': '0 4px 20px -2px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(138, 235, 255, 0.1)',
      }
    },
  },
  plugins: [],
}
