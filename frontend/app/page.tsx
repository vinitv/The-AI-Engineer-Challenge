'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Key, Settings, Loader2, CheckCircle, XCircle, Shield, Building2, FileText, Lightbulb } from 'lucide-react'
import MarkdownRenderer from '../components/MarkdownRenderer'

// Type definitions for better type safety
interface Message {
  role: 'user' | 'assistant' | 'developer'
  content: string
  timestamp: Date
  followUpQuestions?: string[]
}

interface ChatRequest {
  developer_message: string
  user_message: string
  model: string
  api_key: string
}

interface CompanyDocument {
  doc_id: string
  company_name: string
  filename: string
  chunks_count: number
}

export default function SalesResearchPage() {
  // State management for the sales research application
  const [messages, setMessages] = useState<Message[]>([])
  const [userInput, setUserInput] = useState('')
  const [developerMessage, setDeveloperMessage] = useState('You are a helpful AI assistant. Please provide accurate and helpful responses.')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4.1-mini')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [error, setError] = useState('')
  const [isValidatingKey, setIsValidatingKey] = useState(false)
  const [keyValidationStatus, setKeyValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [companyDocument, setCompanyDocument] = useState<CompanyDocument | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [ragMode, setRagMode] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false)
  
  // Refs for auto-scrolling and focus management
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userInputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle sending messages to the API
  const handleSendMessage = async () => {
    if (!userInput.trim() || !apiKey.trim() || isLoading) return

    // Clear any previous errors
    setError('')
    
    // Create user message
    const userMessage: Message = {
      role: 'user',
      content: userInput.trim(),
      timestamp: new Date()
    }

    // Add user message to chat
    setMessages(prev => [...prev, userMessage])
    const currentUserInput = userInput
    setUserInput('')
    setIsLoading(true)

    try {
      // Prepare request for FastAPI backend
      const requestBody: ChatRequest = {
        developer_message: developerMessage,
        user_message: currentUserInput,
        model: model,
        api_key: apiKey
      }

      // Send request to FastAPI backend with streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      // Create assistant message for streaming
      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, assistantMessage])

      // Process streaming response
      let accumulatedContent = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulatedContent += chunk

        // Update the assistant message with accumulated content
        setMessages(prev => 
          prev.map((msg, index) => 
            index === prev.length - 1 && msg.role === 'assistant'
              ? { ...msg, content: accumulatedContent }
              : msg
          )
        )
      }

      // Focus back to input after streaming is complete for better UX
      setTimeout(() => {
        userInputRef.current?.focus()
      }, 100)
    } catch (err) {
      console.error('Error sending message:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message. Please check your API key and try again.')
      
      // Remove the user message if there was an error
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Enter key press for sending messages
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (ragMode) {
        handleSendRagMessage()
      } else {
        handleSendMessage()
      }
    }
  }

  // Clear chat history
  const clearChat = () => {
    setMessages([])
    setError('')
  }

  // Validate OpenAI API key
  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      setKeyValidationStatus('invalid')
      return
    }

    setIsValidatingKey(true)
    setKeyValidationStatus('idle')

    try {
      // Test the API key with a minimal request to OpenAI
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setKeyValidationStatus('valid')
      } else {
        setKeyValidationStatus('invalid')
      }
    } catch (err) {
      console.error('API key validation failed:', err)
      setKeyValidationStatus('invalid')
    } finally {
      setIsValidatingKey(false)
    }
  }

  // Handle company document upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !apiKey.trim() || !companyName.trim()) {
      setUploadError('Please select a PDF file, enter your OpenAI API key, and provide a company name.')
      return
    }
    
    // Validate file type on frontend
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please select a PDF file.')
      return
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      setUploadError(`File too large. Maximum size is 10MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`)
      return
    }
    
    setUploading(true)
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', apiKey)
      formData.append('company_name', companyName)
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(errorData.detail || `Upload failed with status ${res.status}`)
      }
      
      const data = await res.json()
      setCompanyDocument(data)
      setRagMode(true)
      setUploadError('') // Clear any previous errors
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setUploadError(errorMessage)
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  // Handle sending messages (RAG mode)
  const handleSendRagMessage = async () => {
    if (!userInput.trim() || !apiKey.trim() || isLoading || !companyDocument) return
    setError('')
    const userMessage: Message = {
      role: 'user',
      content: userInput.trim(),
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    const currentUserInput = userInput
    setUserInput('')
    setIsLoading(true)
    try {
      const requestBody = {
        doc_id: companyDocument.doc_id,
        developer_message: developerMessage,
        user_message: currentUserInput,
        model: model,
        api_key: apiKey
      }
      const response = await fetch('/api/rag_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('Response body is not readable')
      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      let accumulatedContent = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulatedContent += chunk
        setMessages(prev =>
          prev.map((msg, index) =>
            index === prev.length - 1 && msg.role === 'assistant'
              ? { ...msg, content: accumulatedContent }
              : msg
          )
        )
      }
      
      // Generate follow-up questions
      await generateFollowUpQuestions(currentUserInput)
      
      setTimeout(() => {
        userInputRef.current?.focus()
      }, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message. Please check your API key and try again.')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  // Generate follow-up questions
  const generateFollowUpQuestions = async (userMessage: string) => {
    if (!companyDocument) return
    
    setGeneratingFollowUp(true)
    try {
      const response = await fetch('/api/generate_followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: companyDocument.doc_id,
          user_message: userMessage,
          model: model,
          api_key: apiKey
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setMessages(prev => 
          prev.map((msg, index) => 
            index === prev.length - 1 && msg.role === 'assistant'
              ? { ...msg, followUpQuestions: data.questions }
              : msg
          )
        )
      }
    } catch (err) {
      console.error('Failed to generate follow-up questions:', err)
    } finally {
      setGeneratingFollowUp(false)
    }
  }

  // Handle follow-up question click
  const handleFollowUpClick = (question: string) => {
    setUserInput(question)
    userInputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header with excellent contrast */}
      <header className="bg-card border-b border-border p-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Building2 className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-card-foreground">Sales Research Assistant</h1>
            <p className="text-sm text-secondary">AI-powered customer research for pre-sales & sales teams</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-secondary flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          
          <button
            onClick={clearChat}
            className="btn-secondary"
            disabled={messages.length === 0}
          >
            Clear Chat
          </button>
        </div>
      </header>

      {/* Settings Panel with good contrast */}
      {showSettings && (
        <div className="bg-card border-b border-border p-4 space-y-4 fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API Key input with password style for security */}
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">
                <Key className="w-4 h-4 inline mr-2" />
                OpenAI API Key
              </label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setKeyValidationStatus('idle') // Reset validation when key changes
                  }}
                  className="input-field flex-1"
                  placeholder="sk-..."
                />
                <button
                  onClick={validateApiKey}
                  disabled={isValidatingKey || !apiKey.trim()}
                  className="btn-secondary px-3"
                >
                  {isValidatingKey ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">Testing</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span className="hidden sm:inline">Test</span>
                    </>
                  )}
                </button>
              </div>
              
              {/* Validation feedback */}
              {keyValidationStatus === 'valid' && (
                <p className="text-sm text-green-400 mt-1 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  API key is valid and ready to use!
                </p>
              )}
              {keyValidationStatus === 'invalid' && (
                <p className="text-sm text-red-400 mt-1 flex items-center">
                  <XCircle className="w-4 h-4 mr-1" />
                  Invalid API key. Please check and try again.
                </p>
              )}
            </div>
            
            {/* Model selection */}
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="input-field w-full"
              >
                <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
          </div>
          
          {/* Developer/System message */}
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              System Message
            </label>
            <textarea
              value={developerMessage}
              onChange={(e) => setDeveloperMessage(e.target.value)}
              className="input-field w-full h-20 resize-none"
              placeholder="Enter system instructions for the AI..."
            />
          </div>
        </div>
      )}

      {/* Error display with high contrast */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 mx-4 mt-4 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Chat messages area with custom scrollbar */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center text-secondary mt-20">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-semibold text-card-foreground mb-2">Welcome to Sales Research Assistant</h2>
            <p>Upload company documents and start researching potential customers.</p>
            {!apiKey ? (
              <p className="mt-2 text-sm">Don't forget to add your OpenAI API key in settings!</p>
            ) : keyValidationStatus === 'invalid' ? (
              <p className="mt-2 text-sm text-red-400">Please fix your API key in settings before researching.</p>
            ) : keyValidationStatus === 'idle' ? (
              <p className="mt-2 text-sm text-secondary">Consider testing your API key in settings first.</p>
            ) : null}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-start space-x-3 fade-in ${
                message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              {/* Avatar with high contrast */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-accent text-accent-foreground'
              }`}>
                {message.role === 'user' ? 
                  <User className="w-4 h-4" /> : 
                  <Bot className="w-4 h-4" />
                }
              </div>
              
              {/* Message content with proper contrast and rich text rendering */}
              <div className={`max-w-[70%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-card-foreground border border-border'
              }`}>
                {message.role === 'user' ? (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                ) : (
                  <div>
                    <MarkdownRenderer 
                      content={message.content} 
                      className="prose prose-invert max-w-none"
                    />
                    
                    {/* Follow-up questions */}
                    {message.followUpQuestions && message.followUpQuestions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center mb-2">
                          <Lightbulb className="w-4 h-4 mr-2 text-yellow-500" />
                          <span className="text-sm font-medium text-card-foreground">Suggested Follow-up Questions:</span>
                        </div>
                        <div className="space-y-2">
                          {message.followUpQuestions.map((question, qIndex) => (
                            <button
                              key={qIndex}
                              onClick={() => handleFollowUpClick(question)}
                              className="block w-full text-left p-2 text-sm bg-accent hover:bg-accent/80 rounded border border-border transition-colors"
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <span className={`text-xs mt-2 block opacity-70`}>
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start space-x-3 fade-in">
            <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-card text-card-foreground border border-border p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing company data...</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Follow-up questions loading */}
        {generatingFollowUp && (
          <div className="flex items-start space-x-3 fade-in">
            <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div className="bg-card text-card-foreground border border-border p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating follow-up questions...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area with excellent UX - boxes grow to fit content */}
      <div className="bg-card border-t border-border p-4">
        <div className="flex space-x-3 items-end">
          <div className="flex-1">
            <textarea
              ref={userInputRef}
              value={userInput}
              onChange={(e) => {
                setUserInput(e.target.value)
                // Auto-resize textarea to fit content
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKeyPress}
              className="input-field w-full resize-none min-h-[44px] max-h-[120px]"
              placeholder={
                !apiKey 
                  ? "Please add your API key in settings first" 
                  : keyValidationStatus === 'invalid'
                  ? "Please validate your API key first"
                  : !companyDocument
                  ? "Upload a company document to start researching..."
                  : `Ask about ${companyDocument.company_name}...`
              }
              disabled={!apiKey || isLoading || keyValidationStatus === 'invalid'}
              rows={1}
            />
          </div>
          
          <button
            onClick={ragMode ? handleSendRagMessage : handleSendMessage}
            disabled={!userInput.trim() || !apiKey || isLoading || keyValidationStatus === 'invalid' || (ragMode && !companyDocument)}
            className="btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        <p className="text-xs text-secondary mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>

      {/* Company Document Upload UI */}
      <div className="p-4 bg-card border-b border-border flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-card-foreground">Upload Company Document</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Company Name Input */}
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="input-field w-full"
              placeholder="e.g., Acme Corporation"
            />
          </div>
          
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Document (PDF)
            </label>
            <input 
              type="file" 
              accept="application/pdf" 
              onChange={handleFileUpload} 
              disabled={uploading || !companyName.trim() || !apiKey.trim()} 
              className="file:mr-2 file:py-1 file:px-3 file:rounded file:border file:border-border file:bg-secondary file:text-foreground w-full" 
            />
            <p className="text-xs text-secondary mt-1">Maximum file size: 10MB</p>
          </div>
        </div>
        
        {/* Status Messages */}
        {uploading && <span className="text-sm text-secondary">Uploading and processing document...</span>}
        {uploadError && <span className="text-sm text-red-500">{uploadError}</span>}
        {companyDocument && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-600 font-medium">
                {companyDocument.company_name} document uploaded successfully!
              </span>
            </div>
            <p className="text-xs text-green-600/80 mt-1">
              {companyDocument.filename} • {companyDocument.chunks_count} text chunks extracted
            </p>
          </div>
        )}
        
        {/* Research Mode Toggle */}
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="ragMode" 
            checked={ragMode} 
            onChange={e => setRagMode(e.target.checked)} 
            disabled={!companyDocument} 
          />
          <label htmlFor="ragMode" className="text-sm text-card-foreground">
            Enable AI-powered company research mode
          </label>
        </div>
      </div>
    </div>
  )
} 