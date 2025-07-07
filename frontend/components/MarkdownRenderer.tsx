'use client'

import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const [copiedCode, setCopiedCode] = useState<string>('')

  // Handle code copying with feedback
  const copyToClipboard = async (text: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(codeId)
      setTimeout(() => setCopiedCode(''), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom code block renderer with syntax highlighting and copy button
          code(props) {
            const { node, inline, className, children, ...rest } = props as any
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : ''
            const codeString = String(children).replace(/\n$/, '')
            const codeId = `${language}-${codeString.slice(0, 20)}`

            if (!inline && language) {
              return (
                <div className="relative group">
                  {/* Language label and copy button */}
                  <div className="flex justify-between items-center bg-gray-800 text-gray-300 px-4 py-2 rounded-t-lg text-sm">
                    <span className="font-mono font-medium">
                      {language.toUpperCase()}
                    </span>
                    <button
                      onClick={() => copyToClipboard(codeString, codeId)}
                      className="flex items-center space-x-1 hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                      title="Copy code"
                    >
                      {copiedCode === codeId ? (
                        <>
                          <Check className="w-4 h-4 text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* Syntax highlighted code */}
                  <SyntaxHighlighter
                    style={oneDark}
                    language={language}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderTopLeftRadius: 0,
                      borderTopRightRadius: 0,
                      borderBottomLeftRadius: '0.5rem',
                      borderBottomRightRadius: '0.5rem',
                    }}
                    codeTagProps={{
                      style: {
                        fontSize: '0.875rem',
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                      }
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              )
            }

            // Inline code
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            )
          },

          // Custom table renderer with better styling
          table(props) {
            const { children } = props as any
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full">{children}</table>
              </div>
            )
          },

          // Enhanced blockquote styling
          blockquote(props) {
            const { children } = props as any
            return (
              <blockquote className="border-l-4 border-accent pl-4 py-2 mb-4 bg-card/30 rounded-r-lg italic">
                {children}
              </blockquote>
            )
          },

          // Custom heading renderers with better styling
          h1(props) {
            const { children } = props as any
            return <h1 className="text-2xl font-bold mb-4 text-primary border-b border-border pb-2">{children}</h1>
          },
          
          h2(props) {
            const { children } = props as any
            return <h2 className="text-xl font-bold mb-3 text-primary">{children}</h2>
          },
          
          h3(props) {
            const { children } = props as any
            return <h3 className="text-lg font-bold mb-2 text-primary">{children}</h3>
          },

          // Enhanced link styling
          a(props) {
            const { href, children } = props as any
            return (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-accent hover:text-accent/80 underline transition-colors"
              >
                {children}
              </a>
            )
          },

          // Enhanced list styling  
          ul(props) {
            const { children } = props as any
            return <ul className="mb-3 ml-4 space-y-1">{children}</ul>
          },
          
          ol(props) {
            const { children } = props as any
            return <ol className="mb-3 ml-4 space-y-1">{children}</ol>
          },

          // Enhanced paragraph styling
          p(props) {
            const { children } = props as any
            return <p className="mb-3 leading-relaxed">{children}</p>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
} 