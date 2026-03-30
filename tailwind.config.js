/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          base: '#020617',    // slate-950 — page background
          card: '#0f172a',    // slate-900 — card backgrounds
          raised: '#1e293b',  // slate-800 — elevated surfaces
        },
        border: {
          DEFAULT: '#334155', // slate-700
          subtle: '#1e293b',  // slate-800
        },
        accent: {
          DEFAULT: '#8b5cf6', // violet-500
          hover: '#7c3aed',   // violet-600
          muted: 'rgba(139,92,246,0.1)',
          border: 'rgba(139,92,246,0.2)',
        },
        content: {
          primary: '#f8fafc',   // slate-50
          secondary: '#cbd5e1', // slate-300
          muted: '#64748b',     // slate-500
        }
      }
    },
  },
  plugins: [],
}
