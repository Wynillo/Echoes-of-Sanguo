import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './js/**/*.{ts,tsx,js}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Silkscreen"', 'monospace'],
        title: ['"Press Start 2P"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0',
        none: '0',
        sm: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '0',
      },
      colors: {
        bg:           'var(--bg)',
        bg2:          'var(--bg2)',
        panel:        'var(--panel)',
        border:       'var(--border)',
        'border-glow':'var(--border-glow)',
        gold:         'var(--gold)',
        'gold-light': 'var(--gold-light)',
        text:         'var(--text)',
        'text-dim':   'var(--text-dim)',
        red:          'var(--red)',
        green:        'var(--green)',
      },
    },
  },
  plugins: [],
} satisfies Config
