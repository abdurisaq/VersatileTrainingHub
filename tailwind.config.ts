import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', 
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#6D28D9', 
        'brand-secondary': '#9333EA',
        'brand-accent': '#FACC15', 
        'neutral-light': '#F8FAFC',    
        'neutral-medium': '#E2E8F0',
        'neutral-dark': '#334155',     
        
        'dark-bg': '#1A202C',          
        'dark-text': '#E2E8F0',        
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}
export default config