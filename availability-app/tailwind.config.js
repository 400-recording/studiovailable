/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        available: '#22c55e',
        'available-hover': '#16a34a',
        maybe: '#eab308',
        'maybe-hover': '#ca8a04',
        unavailable: '#ef4444',
        'unavailable-hover': '#dc2626',
        booked: '#7c3aed',
        unset: '#1e293b',
        'unset-hover': '#334155',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
