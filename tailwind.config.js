/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./*.html",
    "./*.js",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary-accent)',
          light: 'var(--primary-accent-light)',
          lighter: 'var(--primary-accent-lighter)',
          dark: 'var(--primary-accent-dark)',
        },
        dark: {
          primary: 'var(--dark-primary-accent)',
          light: 'var(--dark-primary-accent-light)',
          lighter: 'var(--dark-primary-accent-lighter)',
        },
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        border: 'var(--border-color)',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
      },
      animation: {
        'message-slide-in': 'messageSlideIn 0.2s ease forwards',
        'dot-pop-in': 'dotPopIn 0.3s ease-out forwards',
        'spin': 'spin 1s ease-in-out infinite',
        'blink': 'blink 1s infinite',
        'fade-in-out': 'fadeInAndOut 4s ease-in-out forwards',
        'logo-float': 'logoFloat 3s ease-in-out infinite',
        'send-pulse': 'sendPulse 0.3s ease',
        'typing': 'typing 0.5s steps(5)',
      },
      keyframes: {
        messageSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        dotPopIn: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        spin: {
          'to': { transform: 'rotate(360deg)' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        fadeInAndOut: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '10%': { opacity: '1', transform: 'translateY(0)' },
          '90%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-20px)' },
        },
        logoFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        sendPulse: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
}
