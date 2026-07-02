/**
 * Tailwind configuration — EduShift
 *
 * Design tokens are defined as CSS custom properties (see `src/styles/tokens.scss`)
 * using the `<R> <G> <B>` triplet pattern. That keeps Tailwind opacity modifiers
 * (`bg-primary/50`) fully functional while letting us:
 *   - swap palette per theme (light / dark) via the `.dark` class
 *   - swap palette per tenant via the `[data-tenant]` attribute or runtime overrides
 *
 * @type {import('tailwindcss').Config}
 */
const plugin = require('tailwindcss/plugin');

/** Helper: bind a CSS var as a Tailwind color compatible with opacity modifiers. */
const withAlpha = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{html,ts}'],

  darkMode: 'class',

  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
        xl: '2.5rem'
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1440px'
      }
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: withAlpha('--color-primary-500'),
          50: withAlpha('--color-primary-50'),
          100: withAlpha('--color-primary-100'),
          200: withAlpha('--color-primary-200'),
          300: withAlpha('--color-primary-300'),
          400: withAlpha('--color-primary-400'),
          500: withAlpha('--color-primary-500'),
          600: withAlpha('--color-primary-600'),
          700: withAlpha('--color-primary-700'),
          800: withAlpha('--color-primary-800'),
          900: withAlpha('--color-primary-900'),
          950: withAlpha('--color-primary-950')
        },

        accent: {
          DEFAULT: withAlpha('--color-accent-500'),
          50: withAlpha('--color-accent-50'),
          100: withAlpha('--color-accent-100'),
          200: withAlpha('--color-accent-200'),
          300: withAlpha('--color-accent-300'),
          400: withAlpha('--color-accent-400'),
          500: withAlpha('--color-accent-500'),
          600: withAlpha('--color-accent-600'),
          700: withAlpha('--color-accent-700'),
          800: withAlpha('--color-accent-800'),
          900: withAlpha('--color-accent-900'),
          950: withAlpha('--color-accent-950')
        },

        surface: {
          DEFAULT: withAlpha('--color-surface'),
          subtle: withAlpha('--color-surface-subtle'),
          muted: withAlpha('--color-surface-muted'),
          raised: withAlpha('--color-surface-raised'),
          inverted: withAlpha('--color-surface-inverted')
        },

        content: {
          DEFAULT: withAlpha('--color-content'),
          muted: withAlpha('--color-content-muted'),
          subtle: withAlpha('--color-content-subtle'),
          inverted: withAlpha('--color-content-inverted')
        },

        border: {
          DEFAULT: withAlpha('--color-border'),
          subtle: withAlpha('--color-border-subtle'),
          strong: withAlpha('--color-border-strong')
        },

        success: withAlpha('--color-success'),
        warning: withAlpha('--color-warning'),
        danger: withAlpha('--color-danger'),
        info: withAlpha('--color-info'),

        focus: withAlpha('--color-focus')
      },

      fontFamily: {
        /* `sans` reads `--font-sans` so tenant overrides flow through. We
           keep an explicit fallback chain so Tailwind compiles a usable
           font-family even without the variable. */
        sans: ['var(--font-sans)', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }]
      },

      borderRadius: {
        /* Static t-shirt sizes for one-off needs. The semantic `base` alias
           reads `--radius-base` so tenants can scale all "default" radii in
           one place (`btn`, `card`, `input` all use `base` via `_components.scss`). */
        xs: '0.125rem',
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        base: 'var(--radius-base)'
      },

      boxShadow: {
        'soft-sm': '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        soft: '0 2px 8px -2px rgb(0 0 0 / 0.06), 0 4px 16px -4px rgb(0 0 0 / 0.05)',
        'soft-lg': '0 10px 30px -10px rgb(0 0 0 / 0.15)',
        'focus-ring': '0 0 0 3px rgb(var(--color-focus) / 0.35)'
      },

      transitionDuration: {
        DEFAULT: '180ms'
      },

      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'slide-up': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },

      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 240ms ease-out',
        shimmer: 'shimmer 1.4s linear infinite'
      }
    }
  },

  future: {
    hoverOnlyWhenSupported: true
  },

  plugins: [
    require('@tailwindcss/forms')({ strategy: 'class' }),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),

    plugin(({ addVariant }) => {
      addVariant('hocus', ['&:hover', '&:focus-visible']);
      addVariant('group-hocus', [':merge(.group):hover &', ':merge(.group):focus-visible &']);
      addVariant('supports-backdrop', '@supports (backdrop-filter: blur(0))');
    })
  ]
};
