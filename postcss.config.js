/**
 * Explicit PostCSS config — Angular auto-detects Tailwind, but pinning it here:
 *   1. removes ambiguity about which PostCSS pipeline runs
 *   2. lets us add extra processors (e.g. nesting) without surprises
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
