import { useState, useCallback } from 'react'
import ProteinViewer from './components/ProteinViewer'
import ChatPanel from './components/ChatPanel'
import ProteinSearch from './components/ProteinSearch'
import './App.css'

async function fetchProteinMeta(pdbId) {
  const id = pdbId.toLowerCase()
  const res = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${id}`)
  if (!res.ok) throw new Error(`PDB entry ${pdbId} not found`)
  const data = await res.json()

  const title = data.struct?.title || ''
  const method = data.exptl?.[0]?.method || ''
  const resolution = data.refine?.[0]?.ls_d_res_high?.toFixed(2) || null
  const organism = data.rcsb_entry_container_identifiers?.entry_id
    ? (await fetchOrganism(id))
    : null
  const chains = data.rcsb_entry_info?.polymer_entity_count_protein
    ? null // will be filled below
    : null
  const description = data.struct?.pdbx_descriptor || title
  const keywords = data.struct_keywords?.pdbx_keywords || ''

  // Fetch polymer entities for chain/organism info
  let chainIds = []
  let orgName = null
  try {
    const polyRes = await fetch(`https://data.rcsb.org/rest/v1/core/polymer_entity/${id}/1`)
    if (polyRes.ok) {
      const poly = await polyRes.json()
      orgName = poly.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name || null
      chainIds = poly.entity_poly?.pdbx_strand_id?.split(',').map(s => s.trim()) || []
    }
  } catch {}

  return {
    id: pdbId.toUpperCase(),
    title: title || pdbId.toUpperCase(),
    method,
    resolution,
    organism: orgName,
    chains: chainIds,
    description,
    keywords,
  }
}

// Separate helper kept for clarity (not used above — inline)
async function fetchOrganism(id) {
  return null
}

export default function App() {
  const [pdbId, setPdbId] = useState(null)
  const [protein, setProtein] = useState(null)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [metaError, setMetaError] = useState(null)
  const [highlights, setHighlights] = useState([])

  const handleLoad = useCallback(async (id) => {
    setPdbId(id)
    setProtein(null)
    setMetaError(null)
    setHighlights([])
    setLoadingMeta(true)
    try {
      const meta = await fetchProteinMeta(id)
      setProtein(meta)
    } catch (err) {
      setMetaError(err.message)
    } finally {
      setLoadingMeta(false)
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" strokeLinecap="round"/>
            <path d="M8 12 q2-4 4 0 q2 4 4 0" strokeLinecap="round"/>
            <circle cx="8" cy="9" r="1" fill="currentColor" stroke="none"/>
            <circle cx="16" cy="15" r="1" fill="currentColor" stroke="none"/>
          </svg>
          <span className="header-title">Protein Explainer</span>
        </div>
        <ProteinSearch onLoad={handleLoad} protein={protein} loading={loadingMeta} />
      </header>

      {metaError && (
        <div className="meta-error">{metaError}</div>
      )}

      <div className="app-body">
        <div className="viewer-panel">
          <ProteinViewer pdbId={pdbId} highlights={highlights} />
        </div>
        <div className="chat-side">
          <ChatPanel protein={protein} onHighlight={setHighlights} />
        </div>
      </div>
    </div>
  )
}
