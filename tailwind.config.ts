import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './js/**/*.{ts,tsx,js}'],
  theme: {
    extend: {
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
