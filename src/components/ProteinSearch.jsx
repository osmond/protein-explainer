import { useState } from 'react'

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

export default function ProteinSearch({ onLoad, protein, loading }) {
  const [value, setValue] = useState('')

  function submit(id) {
    const clean = (id || value).trim().toUpperCase()
    if (!clean) return
    onLoad(clean)
    setValue('')
  }

  return (
    <div className="search-bar">
      <div className="search-input-row">
        <input
          className="search-input"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Enter PDB ID (e.g. 1HHO)"
          maxLength={8}
          spellCheck={false}
        />
        <button className="search-btn" onClick={() => submit()} disabled={loading}>
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>

      {protein ? (
        <div className="protein-meta">
          <span className="protein-id">{protein.id}</span>
          <span className="protein-title">{protein.title}</span>
          {protein.organism && <span className="protein-organism">· {protein.organism}</span>}
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
