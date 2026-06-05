import { useState, useRef } from 'react'

const SUGGESTIONS = [
  { id: '1HHO', name: 'Hemoglobin' },
  { id: '1ATP', name: 'Protein Kinase A' },
  { id: '1TIM', name: 'Triosephosphate Isomerase' },
  { id: '4HHB', name: 'Hemoglobin (deoxy)' },
  { id: '1BNA', name: 'DNA B-form' },
  { id: '1MBN', name: 'Myoglobin' },
  { id: '6LU7', name: 'SARS-CoV-2 Protease' },
  { id: '3HHR', name: 'Growth Hormone Receptor' },
]

// Looks like a PDB ID: 1–4 alphanumeric chars
const PDB_RE = /^[A-Z0-9]{1,4}$/

export default function ProteinSearch({ onLoad, protein, loading }) {
  const [value,    setValue]    = useState('')
  const [results,  setResults]  = useState([])
  const [searching, setSearching] = useState(false)
  const [open,     setOpen]     = useState(false)
  const searchTimer = useRef(null)
  const wrapRef     = useRef(null)

  function submit(id) {
    const clean = (id || value).trim().toUpperCase()
    if (!clean) return
    setOpen(false)
    setValue('')
    setResults([])
    onLoad(clean)
  }

  function handleChange(e) {
    const raw = e.target.value
    setValue(raw)
    clearTimeout(searchTimer.current)

    const up = raw.trim().toUpperCase()
    // If it's a short PDB-ID-shaped string don't bother searching by name
    if (up.length < 3 || PDB_RE.test(up)) {
      setResults([])
      setOpen(false)
      return
    }

    setSearching(true)
    searchTimer.current = setTimeout(() => doSearch(raw.trim()), 380)
  }

  async function doSearch(q) {
    try {
      const searchRes = await fetch('https://search.rcsb.org/rcsbsearch/v2/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: {
            type: 'terminal',
            service: 'full_text',
            parameters: { value: q },
          },
          return_type: 'entry',
          request_options: {
            paginate: { start: 0, rows: 6 },
            sort: [{ sort_by: 'score', direction: 'desc' }],
          },
        }),
      })
      if (!searchRes.ok) throw new Error()
      const data = await searchRes.json()
      const ids = (data.result_set || []).map(r => r.identifier).slice(0, 6)
      if (!ids.length) { setResults([]); setOpen(false); return }

      // Fetch titles via RCSB GraphQL in one round-trip
      const gql = await fetch('https://data.rcsb.org/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{ entries(entry_ids: ${JSON.stringify(ids)}) { rcsb_id struct { title } } }`,
        }),
      })
      const gqlData = await gql.json()
      const entries = gqlData.data?.entries || []
      setResults(entries.map(e => ({ id: e.rcsb_id, title: e.struct?.title || e.rcsb_id })))
      setOpen(true)
    } catch {
      setResults([])
      setOpen(false)
    } finally {
      setSearching(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div className="search-bar">
      <div className="search-input-row" ref={wrapRef}>
        <div className="search-field-wrap">
          <input
            className="search-input"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="PDB ID or protein name…"
            maxLength={60}
            spellCheck={false}
            autoComplete="off"
          />
          {searching && <span className="search-spinner" />}

          {open && results.length > 0 && (
            <div className="search-dropdown">
              {results.map(r => (
                <button
                  key={r.id}
                  className="search-result-item"
                  onMouseDown={() => submit(r.id)}
                >
                  <span className="search-result-id">{r.id}</span>
                  <span className="search-result-title">{r.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="search-btn" onClick={() => submit()} disabled={loading}>
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>

      {protein ? (
        <div className="protein-meta">
          <span className="protein-id">{protein.id}</span>
          <span className="protein-title">{protein.title}</span>
          {protein.organism  && <span className="protein-organism">· {protein.organism}</span>}
          {protein.resolution && <span className="protein-res">· {protein.resolution} Å</span>}
        </div>
      ) : (
        <div className="suggestions">
          {SUGGESTIONS.map(s => (
            <button key={s.id} className="suggestion-btn" onClick={() => submit(s.id)}>
              <span className="suggestion-id">{s.id}</span>
              <span className="suggestion-name">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
