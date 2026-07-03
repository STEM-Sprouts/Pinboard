/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#57BE6C',
        'primary-deep': '#3EA254',
        ink: '#111111',
        accent: '#57BE6C',
        background: '#FAFAF8',
        surface: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['"Source Code Pro"', 'monospace'],
      },
    },
  },
  plugins: [],
}
