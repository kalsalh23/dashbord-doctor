const defaultTheme = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // لوحة العيادة — متغيّرات CSS كي تُبدَّل لكل عيادة على حدة
        // (افتراضي: برقوقي/موف أنيق · عيادة د. عارف: فيروزي كما كان سابقاً)
        primary: {
          50: 'rgb(var(--p50) / <alpha-value>)',
          100: 'rgb(var(--p100) / <alpha-value>)',
          200: 'rgb(var(--p200) / <alpha-value>)',
          300: 'rgb(var(--p300) / <alpha-value>)',
          400: 'rgb(var(--p400) / <alpha-value>)',
          500: 'rgb(var(--p500) / <alpha-value>)',
          600: 'rgb(var(--p600) / <alpha-value>)',
          700: 'rgb(var(--p700) / <alpha-value>)',
          800: 'rgb(var(--p800) / <alpha-value>)',
          900: 'rgb(var(--p900) / <alpha-value>)',
        },
      },
      boxShadow: {
        // ظل ملوّن بلون العيادة نفسه (يتغيّر مع الثيم)
        card: '0 1px 2px 0 rgb(var(--p900) / 0.04), 0 2px 8px -2px rgb(var(--p900) / 0.07)',
      },
    },
  },
  plugins: [],
}
