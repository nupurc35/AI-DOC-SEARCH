import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const UPLOAD_URL = `${API_URL}/upload`
const ASK_URL = `${API_URL}/ask`

function SourceList({ sources = [] }) {
  const [open, setOpen] = useState(false)

  if (!sources.length) {
    return null
  }

  return (
    <div className="sources">
      <button
        type="button"
        className="sources-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Hide Sources' : 'View Sources'}
      </button>
      {open ? (
        <div className="source-list">
          {sources.map((source, index) => (
            <div className="source-card" key={`${index}-${source.slice(0, 24)}`}>
              <div className="source-label">Chunk {index + 1}</div>
              <pre>{source}</pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function App() {
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputBarRef = useRef(null)
  const switchTimerRef = useRef(null)
  const [screen, setScreen] = useState('upload')
  const [dragActive, setDragActive] = useState(false)
  const [uploadState, setUploadState] = useState('idle')
  const [uploadError, setUploadError] = useState('')
  const [chunkCount, setChunkCount] = useState(0)
  const [fileName, setFileName] = useState('')
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [isAsking, setIsAsking] = useState(false)

  useEffect(() => {
    const root = document.documentElement

    const updateViewport = () => {
      const viewport = window.visualViewport
      const height = viewport?.height ?? window.innerHeight
      const offsetTop = viewport?.offsetTop ?? 0
      const keyboardOffset = Math.max(0, window.innerHeight - height - offsetTop)
      const inputHeight = inputBarRef.current?.offsetHeight ?? 0

      root.style.setProperty('--app-vh', `${height}px`)
      root.style.setProperty('--keyboard-offset', `${keyboardOffset}px`)
      root.style.setProperty(
        '--chat-messages-padding-bottom',
        `${Math.max(inputHeight + keyboardOffset + 16, 96)}px`,
      )
    }

    updateViewport()

    window.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('scroll', updateViewport)

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.visualViewport?.removeEventListener('resize', updateViewport)
      window.visualViewport?.removeEventListener('scroll', updateViewport)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAsking])

  useEffect(() => {
    return () => {
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current)
      }
    }
  }, [])

  const resetApp = () => {
    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current)
    }
    setScreen('upload')
    setDragActive(false)
    setUploadState('idle')
    setUploadError('')
    setChunkCount(0)
    setFileName('')
    setMessages([])
    setQuestion('')
    setIsAsking(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const submitFile = async (file) => {
    if (!file) {
      return
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF files are supported.')
      setUploadState('error')
      return
    }

    setUploadState('loading')
    setUploadError('')
    setFileName(file.name)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(UPLOAD_URL, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.detail || 'Upload failed.')
      }

      setChunkCount(data.chunks || 0)
      setUploadState('success')
      switchTimerRef.current = setTimeout(() => {
        setScreen('chat')
      }, 1000)
    } catch (error) {
      setUploadState('error')
      setUploadError(error.message || 'Upload failed.')
    }
  }

  const handleFileChange = async (event) => {
    const [file] = event.target.files || []
    await submitFile(file)
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setDragActive(false)
    const [file] = event.dataTransfer.files || []
    await submitFile(file)
  }

  const handleAsk = async (event) => {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isAsking) {
      return
    }

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', text: trimmedQuestion },
    ])
    setQuestion('')
    setIsAsking(true)

    try {
      const response = await fetch(ASK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: trimmedQuestion }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to get answer.')
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: data.answer || 'I could not find this in the document.',
          sources: Array.isArray(data.sources) ? data.sources : [],
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: error.message || 'Failed to get answer.',
          sources: [],
        },
      ])
    } finally {
      setIsAsking(false)
    }
  }

  if (screen === 'upload') {
    return (
      <div className="app-shell upload-shell">
        <div className="upload-panel">
          <div className="upload-kicker">PDF Chat</div>
          <h1>Upload a document to start chatting</h1>
          <button
            type="button"
            className={`dropzone ${dragActive ? 'drag-active' : ''} ${uploadState}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setDragActive(false)
            }}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              hidden
            />
            {uploadState === 'loading' ? (
              <div className="upload-status">
                <div className="spinner" />
                <div>
                  <div className="status-title">Indexing document...</div>
                  <div className="status-copy">{fileName}</div>
                </div>
              </div>
            ) : null}
            {uploadState === 'success' ? (
              <div className="upload-status success">
                <div className="checkmark">✓</div>
                <div>
                  <div className="status-title">Ready — {chunkCount} chunks indexed</div>
                  <div className="status-copy">{fileName}</div>
                </div>
              </div>
            ) : null}
            {uploadState !== 'loading' && uploadState !== 'success' ? (
              <div className="dropzone-copy">
                <div className="dropzone-title">Drop your PDF here</div>
                <div className="dropzone-subtitle">or click to browse files</div>
              </div>
            ) : null}
          </button>
          {uploadError ? <div className="upload-error">{uploadError}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell chat-shell">
      <header className="chat-navbar">
        <div className="chat-doc">
          <div className="chat-doc-label">Active PDF</div>
          <div className="chat-doc-name">{fileName}</div>
        </div>
        <button type="button" className="reset-button" onClick={resetApp}>
          Reset
        </button>
      </header>

      <main className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            Ask a question about your document. Answers will be grounded in the indexed chunks.
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-row ${message.role === 'user' ? 'user' : 'assistant'}`}
          >
            <div className={`message-bubble ${message.role}`}>
              <div className="message-text">{message.text}</div>
              {message.role === 'assistant' ? <SourceList sources={message.sources} /> : null}
            </div>
          </div>
        ))}

        {isAsking ? (
          <div className="message-row assistant">
            <div className="message-bubble assistant typing-bubble">
              <div className="typing-indicator">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </main>

      <div className="chat-inputbar-wrap" ref={inputBarRef}>
        <form className="chat-inputbar" onSubmit={handleAsk}>
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask something from the PDF..."
            disabled={isAsking}
          />
          <button type="submit" disabled={isAsking || !question.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

export default App

