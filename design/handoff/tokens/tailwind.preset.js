/** Hackathonner — Tailwind preset. Usage: presets: [require('./tailwind.preset.js')] */
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: '#FFFFFF', ink: '#1A1712', muted: '#6B6458', rule: '#DDD5C8', accent: '#8F9BFF',
        brand: { DEFAULT: '#EC6699', hover: '#F07EAA' },
        surface: { DEFAULT: '#E4F2E7', hover: '#D5EADA' },
        deadline: { calm: '#EC6699', amber: '#F59100', red: '#C8160C' }
      },
      fontFamily: { sans: ['Arial', 'Helvetica', 'sans-serif'] },
      borderRadius: { card: '16px', row: '12px', fact: '10px' },
      screens: { mid: '820px', desk: '1120px' },
      transitionTimingFunction: { paper: 'cubic-bezier(.2,.7,.2,1)' }
    }
  }
};
