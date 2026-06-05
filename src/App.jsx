import { useState, useCallback, useRef } from 'react'
import ProteinViewer from './components/ProteinViewer'
import ChatPanel from './components/ChatPanel'
import ProteinSearch from './components/ProteinSearch'
import SequenceStrip from './components/SequenceStrip'
import './App.css'

async function fetchProteinMeta(pdbId) {
  const id = pdbId.toLowerCase()
  const res = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${id}`)
  if (!res.ok) throw new Error(`PDB entry ${pdbId} not found`)
  const data = await res.json()

  const title      = data.struct?.title || ''
  const method     = data.exptl?.[0]?.method || ''
  const resolution = data.refine?.[0]?.ls_d_res_high?.toFixed(2) || null
  const description = data.struct?.pdbx_descriptor || title
  const keywords   = data.struct_keywords?.pdbx_keywords || ''

  let chainIds = []
  let orgName  = null
  let sequence = ''
  try {
    const polyRes = await fetch(`https://data.rcsb.org/rest/v1/core/polymer_entity/${id}/1`)
    if (polyRes.ok) {
      const poly = await polyRes.json()
      orgName  = poly.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name || null
      chainIds = poly.entity_poly?.pdbx_strand_id?.split(',').map(s => s.trim()) || []
      sequence = poly.entity_poly?.pdbx_seq_one_letter_code_can ||
                 poly.entity_poly?.pdbx_seq_one_letter_code || ''
    }
  } catch {}

  return {
    id: pdbId.toUpperCase(),
    title: title || pdbId.toUpperCase(),
    method, resolution, organism: orgName,
    chains: chainIds, description, keywords,
    sequence: sequence.replace(/\s/g, ''),
  }
}

export default function App() {
  const [pdbId,       setPdbId]       = useState(null)
  const [protein,     setProtein]     = useState(null)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [metaError,   setMetaError]   = useState(null)
  const [highlights,  setHighlights]  = useState([])
  const [prefill,     setPrefill]     = useState(null)
  const [splitPct,    setSplitPct]    = useState(60)
  const isResizing = useRef(false)

  const handleLoad = useCallback(async (id) => {
    setPdbId(id)
    setProtein(null)
    setMetaError(null)
    setHighlights([])
    setPrefill(null)
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

  // Clicking an atom in the viewer pre-fills the chat input
  const handleResidueClick = useCallback(({ resname, resno, chain }) => {
    setPrefill(`What is ${resname}${resno} doing in this protein? Why is it important?`)
  }, [])

  // Draggable divider between viewer and chat
  function startResize(e) {
    e.preventDefault()
    isResizing.current = true

    function onMove(e) {
      if (!isResizing.current) return
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const pct = (clientX / window.innerWidth) * 100
      setSplitPct(Math.min(80, Math.max(20, Math.round(pct))))
    }
    function onUp() {
      isResizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend',  onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend',  onUp)
  }

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

      {metaError && <div className="meta-error">{metaError}</div>}

      <div className="app-body">
        <div className="viewer-panel" style={{ flex: `0 0 ${splitPct}%` }}>
          <ProteinViewer
            pdbId={pdbId}
            highlights={highlights}
            onResidueClick={handleResidueClick}
          />
          <SequenceStrip
            pdbId={pdbId}
            chain={protein?.chains?.[0]}
            highlights={highlights}
            onResidueClick={handleResidueClick}
          />
        </div>

        <div
          className="resize-divider"
          onMouseDown={startResize}
          onTouchStart={startResize}
        />

        <div className="chat-side">
          <ChatPanel
            protein={protein}
            onHighlight={setHighlights}
            prefillQuestion={prefill}
            onPrefillUsed={() => setPrefill(null)}
          />
        </div>
      </div>
    </div>
  )
}
