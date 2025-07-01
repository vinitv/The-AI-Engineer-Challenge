import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

// Using Inter font for modern, readable typography
const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Chat Assistant',
  description: 'A modern chat interface powered by OpenAI GPT models',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </body>
    </html>
  )
} 