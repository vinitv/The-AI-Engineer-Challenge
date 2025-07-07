'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Key, Settings, Loader2, CheckCircle, XCircle, Shield, Upload, FileText, Building2 } from 'lucide-react'
import MarkdownRenderer from '../components/MarkdownRenderer'

// Type definitions for better type safety
interface Message {
  role: 'user' | 'assistant' | 'developer'
  content: string
  timestamp: Date
}

interface ChatRequest {
  developer_message: string
  user_message: string
  model: string
  api_key: string
}

interface Document {
  doc_id: string
  filename: string
  type: 'california_re' | 'user_upload'
  chunks_count: number
}

interface RAGChatRequest {
  doc_ids: string[]
  user_message: string
  developer_message?: string
  model: string
  api_key: string
}

export default function ChatPage() {
  // State management for the chat application
  const [messages, setMessages] = useState<Message[]>([])
  const [userInput, setUserInput] = useState('')
  const [developerMessage, setDeveloperMessage] = useState('You are a knowledgeable California real estate assistant. Answer questions about California real estate law, regulations, and procedures based on the provided documents.')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4.1-mini')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [error, setError] = useState('')
  const [isValidatingKey, setIsValidatingKey] = useState(false)
  const [keyValidationStatus, setKeyValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [ragMode, setRagMode] = useState(false)
  const [availableDocs, setAvailableDocs] = useState<{california_re_documents: Document[], user_documents: Document[]}>({california_re_documents: [], user_documents: []})
  const [showDocumentSelector, setShowDocumentSelector] = useState(false)
  
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

  // Load available documents on component mount
  useEffect(() => {
    loadAvailableDocuments()
  }, [])

  const loadAvailableDocuments = async () => {
    try {
      const response = await fetch('/api/available_docs')
      if (response.ok) {
        const data = await response.json()
        setAvailableDocs(data)
        // Start with no documents selected by default
        setSelectedDocs([])
        setRagMode(false)
      }
    } catch (err) {
      console.error('Failed to load available documents:', err)
    }
  }

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

  // Handle multiple PDF uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0 || !apiKey.trim()) {
      setUploadError('Please select PDF files and enter your OpenAI API key.')
      return
    }
    
    setUploading(true)
    setUploadError('')
    
    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })
      formData.append('api_key', apiKey)
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!res.ok) throw new Error('Failed to upload PDFs')
      
      const data = await res.json()
      console.log('Uploaded documents:', data.uploaded_docs)
      
      // Refresh available documents
      await loadAvailableDocuments()
      
      // Auto-enable RAG mode
      setRagMode(true)
      
    } catch (err) {
      setUploadError('Upload failed. Only PDF files are supported.')
    } finally {
      setUploading(false)
    }
  }

  // Handle sending messages (RAG mode)
  const handleSendRagMessage = async () => {
    if (!userInput.trim() || !apiKey.trim() || isLoading || selectedDocs.length === 0) return
    
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
      const requestBody: RAGChatRequest = {
        doc_ids: selectedDocs,
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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`
        throw new Error(errorMessage)
      }
      
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
      
      setTimeout(() => {
        userInputRef.current?.focus()
      }, 100)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message. Please check your API key and try again.'
      setError(errorMessage)
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocs(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header with California real estate branding */}
      <header className="bg-card border-b border-border p-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Building2 className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-card-foreground">California Real Estate Assistant</h1>
            <p className="text-sm text-secondary">Powered by California RE Law & OpenAI</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDocumentSelector(!showDocumentSelector)}
            className="btn-secondary flex items-center space-x-2"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Documents</span>
          </button>
          
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

      {/* Document Selector Panel */}
      {showDocumentSelector && (
        <div className="bg-card border-b border-border p-4 space-y-4 fade-in">
          <h3 className="font-semibold text-card-foreground">Select Documents for RAG Chat</h3>
          
          {/* California RE Documents */}
          <div>
            <h4 className="text-sm font-medium text-card-foreground mb-2">California Real Estate Law Documents</h4>
            <div className="space-y-2">
              {availableDocs.california_re_documents.map((doc) => (
                <label key={doc.doc_id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc.doc_id)}
                    onChange={() => toggleDocumentSelection(doc.doc_id)}
                    className="rounded"
                  />
                  <span className="text-sm">{doc.filename} ({doc.chunks_count} chunks)</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* User Uploaded Documents */}
          {availableDocs.user_documents.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-card-foreground mb-2">Your Uploaded Documents</h4>
              <div className="space-y-2">
                {availableDocs.user_documents.map((doc) => (
                  <label key={doc.doc_id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDocs.includes(doc.doc_id)}
                      onChange={() => toggleDocumentSelection(doc.doc_id)}
                      className="rounded"
                    />
                    <span className="text-sm">{doc.filename} ({doc.chunks_count} chunks)</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <div className="text-xs text-secondary">
            Selected: {selectedDocs.length} document(s)
          </div>
        </div>
      )}

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
                  required
                />
                <button
                  onClick={validateApiKey}
                  disabled={!apiKey.trim() || isValidatingKey}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-1 min-w-[80px] justify-center ${
                    keyValidationStatus === 'valid'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : keyValidationStatus === 'invalid'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-secondary hover:bg-secondary/90 text-secondary-foreground'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={
                    keyValidationStatus === 'valid'
                      ? 'API key is valid'
                      : keyValidationStatus === 'invalid'
                      ? 'API key is invalid'
                      : 'Test API key'
                  }
                >
                  {isValidatingKey ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">Testing</span>
                    </>
                  ) : keyValidationStatus === 'valid' ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Valid</span>
                    </>
                  ) : keyValidationStatus === 'invalid' ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Invalid</span>
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
            <h2 className="text-xl font-semibold text-card-foreground mb-2">California Real Estate Assistant</h2>
            <p>Ask questions about California real estate law, regulations, and procedures.</p>
            {!apiKey ? (
              <p className="mt-2 text-sm">Don't forget to add your OpenAI API key in settings!</p>
            ) : keyValidationStatus === 'invalid' ? (
              <p className="mt-2 text-sm text-red-400">Please fix your API key in settings before chatting.</p>
            ) : keyValidationStatus === 'idle' ? (
              <p className="mt-2 text-sm text-secondary">Consider testing your API key in settings first.</p>
            ) : null}
            {ragMode && selectedDocs.length > 0 && (
              <p className="mt-2 text-sm text-green-400">
                ✓ RAG mode enabled with {selectedDocs.length} document(s) selected
              </p>
            )}
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
                  <MarkdownRenderer 
                    content={message.content} 
                    className="prose prose-invert max-w-none"
                  />
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
                <span>Analyzing California real estate documents...</span>
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
                  : keyValidationStatus === 'valid'
                  ? "Ask about California real estate law, regulations, or procedures..."
                  : "Ask about California real estate law, regulations, or procedures... (consider testing your API key first)"
              }
              disabled={!apiKey || isLoading || keyValidationStatus === 'invalid'}
              rows={1}
            />
          </div>
          
          <button
            onClick={ragMode ? handleSendRagMessage : handleSendMessage}
            disabled={!userInput.trim() || !apiKey || isLoading || keyValidationStatus === 'invalid' || (ragMode && selectedDocs.length === 0)}
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

      {/* Upload and RAG toggle UI */}
      <div className="p-4 bg-card border-b border-border flex flex-col gap-2">
        <label className="font-semibold">Upload additional PDF files:</label>
        <input 
          type="file" 
          accept="application/pdf" 
          multiple
          onChange={handleFileUpload} 
          disabled={uploading} 
          className="file:mr-2 file:py-1 file:px-3 file:rounded file:border file:border-border file:bg-secondary file:text-foreground" 
        />
        {uploading && <span className="text-sm text-secondary">Uploading...</span>}
        {uploadError && <span className="text-sm text-red-500">{uploadError}</span>}
        
        <div className="flex items-center gap-2 mt-2">
          <input 
            type="checkbox" 
            id="ragMode" 
            checked={ragMode} 
            onChange={e => setRagMode(e.target.checked)} 
            disabled={selectedDocs.length === 0}
          />
          <label htmlFor="ragMode" className="text-sm">
            RAG mode with {selectedDocs.length} document(s) selected
          </label>
        </div>
      </div>
    </div>
  )
} 