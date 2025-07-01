/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Modern color palette with excellent contrast
        background: '#0f172a', // Dark blue-gray
        foreground: '#f8fafc', // Light gray
        card: '#1e293b', // Medium blue-gray
        'card-foreground': '#f1f5f9',
        primary: '#3b82f6', // Blue
        'primary-foreground': '#ffffff',
        secondary: '#64748b', // Slate
        'secondary-foreground': '#f1f5f9',
        accent: '#06b6d4', // Cyan
        'accent-foreground': '#ffffff',
        destructive: '#ef4444', // Red
        'destructive-foreground': '#ffffff',
        border: '#334155',
        input: '#1e293b',
        ring: '#3b82f6',
      },
    },
  },
  plugins: [],
} 