/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': '11px',
        'sm': '13px', 
        'base': '15px',
        'lg': '17px',
        'xl': '19px',
        '2xl': '23px',
        '3xl': '29px'
      }
    },
  },
  plugins: [],
}
