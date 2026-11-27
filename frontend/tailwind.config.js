/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: '#fbf9f6',
        'surface-dim': '#dbdad7',
        'surface-bright': '#fbf9f6',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f5f3f0',
        'surface-container': '#efeeeb',
        'surface-container-high': '#eae8e5',
        'surface-container-highest': '#e4e2df',
        'on-surface': '#1b1c1a',
        'on-surface-variant': '#46464b',
        'inverse-surface': '#30312f',
        'inverse-on-surface': '#f2f0ed',
        outline: '#76777c',
        'outline-variant': '#c6c6cb',
        'surface-tint': '#5b5e68',
        primary: '#000000',
        'on-primary': '#ffffff',
        'primary-container': '#181b24',
        'on-primary-container': '#81838e',
        'inverse-primary': '#c4c6d1',
        secondary: '#ac3400',
        'on-secondary': '#ffffff',
        'secondary-container': '#fd6b36',
        'on-secondary-container': '#5d1900',
        'secondary-fixed': '#ffdbd0',
        'secondary-fixed-dim': '#ffb59d',
        'on-secondary-fixed': '#390c00',
        'on-secondary-fixed-variant': '#832600',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        // Backward-compat aliases if any
        brand: {
          50: '#ffdbd0',
          500: '#ac3400',
          600: '#832600',
          700: '#5d1900'
        }
      },
      fontFamily: {
        serif: ['"Times New Roman"', 'Times', 'Newsreader', 'Georgia', 'Cambria', 'serif'],
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '0.75rem',
      }
    },
  },
  plugins: [],
}
