import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const RESIDUE_RE = /\b(Ala|Arg|Asn|Asp|Cys|Gln|Glu|Gly|His|Ile|Leu|Lys|Met|Phe|Pro|Ser|Thr|Trp|Tyr|Val)(\d+)\b/g

function parseHighlights(text) {
  const hits = []
  let m
  RESIDUE_RE.lastIndex = 0
  while ((m = RESIDUE_RE.exec(text)) !== null) {
    hits.push({ resname: m[1], resno: m[2] })
  }
  return hits
}

const PRESET_QUESTIONS = [
  'What does this protein do?',
  'Where is the active site?',
  'What secondary structures are present?',
  'Why are the key residues conserved?',
  'How does this protein interact with its partners?',
]

export default function ChatPanel({ protein, onHighlight }) {
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  useEffect(() => {
    setHistory([])
    onHighlight([])
  }, [protein?.id])

  async function send(question) {
    if (!question.trim() || streaming) return
    setInput('')
    const userMsg = { role: 'user', content: question }
    const assistantMsg = { role: 'assistant', content: '' }
    setHistory(h => [...h, userMsg, assistantMsg])
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history, protein }),
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) {
              fullText += parsed.text
              setHistory(h => {
                const next = [...h]
                next[next.length - 1] = { role: 'assistant', content: fullText }
                return next
              })
            }
          } catch {}
        }
      }

      onHighlight(parseHighlights(fullText))
    } catch (err) {
      setHistory(h => {
        const next = [...h]
        next[next.length - 1] = { role: 'assistant', content: `Error: ${err.message}` }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {history.length === 0 ? (
          <div className="chat-empty">
            {protein ? (
              <>
                <p className="chat-empty-title">Ask anything about {protein.title || protein.id}</p>
                <div className="preset-questions">
                  {PRESET_QUESTIONS.map(q => (
                    <button key={q} className="preset-btn" onClick={() => send(q)}>{q}</button>
                  ))}
                </div>
              </>
            ) : (
              <p className="chat-empty-title">Load a protein to start asking questions</p>
            )}
          </div>
        ) : (
          history.map((msg, i) => {
            const isLastAssistant = msg.role === 'assistant' && i === history.length - 1
            const showCursor = streaming && isLastAssistant && msg.content === ''
            return (
              <div key={i} className={`message message-${msg.role}`}>
                <div className="message-label">{msg.role === 'user' ? 'You' : 'Protein Explainer'}</div>
                <div className="message-body">
                  {msg.role === 'user' ? (
                    <div className="message-content">{msg.content}</div>
                  ) : (
                    <ReactMarkdown className="message-content">
                      {msg.content + (streaming && isLastAssistant ? '​' : '')}
                    </ReactMarkdown>
                  )}
                  {showCursor && <span className="cursor" />}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={protein ? 'Ask about the structure…' : 'Load a protein first'}
          disabled={!protein || streaming}
          rows={1}
        />
        <button
          className="send-btn"
          onClick={() => send(input)}
          disabled={!protein || streaming || !input.trim()}
        >
          {streaming ? '…' : '▶'}
        </button>
      </div>
    </div>
  )
}
