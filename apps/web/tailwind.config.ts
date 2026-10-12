import type {Config} from 'tailwindcss';

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        sunken: token('sunken'),
        ink: token('ink'),
        muted: token('muted'),
        faint: token('faint'),
        line: token('line'),
        signal: token('signal'),
        'signal-strong': token('signal-strong'),
        'signal-soft': token('signal-soft'),
        ok: token('ok'),
        'ok-soft': token('ok-soft'),
        warn: token('warn'),
        'warn-soft': token('warn-soft'),
        bad: token('bad'),
        'bad-soft': token('bad-soft'),
        rail: token('rail'),
        'rail-ink': token('rail-ink'),
        'rail-muted': token('rail-muted'),
        'rail-line': token('rail-line'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(17 19 26 / 0.04), 0 1px 1px rgb(17 19 26 / 0.03)',
        lift: '0 12px 32px -12px rgb(17 19 26 / 0.25)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
