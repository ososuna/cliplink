/** @type {import('prettier').Config} */
export default {
  singleQuote: true,
  // prettier-plugin-tailwindcss must stay last.
  plugins: ['prettier-plugin-astro', 'prettier-plugin-tailwindcss'],
  tailwindStylesheet: './src/styles/global.css',
  overrides: [{ files: '*.astro', options: { parser: 'astro' } }],
};
