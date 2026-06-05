import { useEffect, useRef, useState } from 'react'
import * as NGL from 'ngl'

const REPRESENTATIONS = [
  { id: 'cartoon', label: 'Cartoon' },
  { id: 'surface', label: 'Surface' },
  { id: 'ball+stick', label: 'Ball+Stick' },
  { id: 'licorice', label: 'Licorice' },
]

export default function ProteinViewer({ pdbId, highlights }) {
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const compRef = useRef(null)
  const [rep, setRep] = useState('cartoon')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Init NGL stage once
  useEffect(() => {
    const stage = new NGL.Stage(containerRef.current, {
      backgroundColor: '#0f1117',
      quality: 'medium',
    })
    stageRef.current = stage

    const handleResize = () => stage.handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      stage.dispose()
    }
  }, [])

  // Load structure when pdbId changes
  useEffect(() => {
    if (!pdbId || !stageRef.current) return
    setLoading(true)
    setError(null)
    const stage = stageRef.current
    stage.removeAllComponents()
    compRef.current = null

    const url = `https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`
    stage.loadFile(url, { ext: 'pdb', name: pdbId })
      .then(comp => {
        compRef.current = comp
        applyRep(comp, rep)
        comp.autoView()
        setLoading(false)
      })
      .catch(err => {
        setError(`Could not load ${pdbId} — check the PDB ID.`)
        setLoading(false)
      })
  }, [pdbId])

  // Switch representation
  useEffect(() => {
    const comp = compRef.current
    if (!comp) return
    comp.removeAllRepresentations()
    applyRep(comp, rep)
  }, [rep])

  // Highlight residues mentioned by Claude
  useEffect(() => {
    const comp = compRef.current
    if (!comp || !highlights.length) return
    // Remove old highlight reps (labeled 'highlight')
    comp.reprList
      .filter(r => r.name === 'highlight')
      .forEach(r => comp.removeRepresentation(r))

    const sele = highlights.map(r => r.resno + ':' + (r.chain || '')).join(' or ')
    if (sele) {
      comp.addRepresentation('ball+stick', {
        sele,
        colorValue: '#ffcc00',
        name: 'highlight',
        radius: 0.4,
      })
    }
  }, [highlights])

  return (
    <div className="viewer-wrapper">
      <div ref={containerRef} className="ngl-container" />
      {loading && <div className="viewer-overlay">Loading {pdbId}…</div>}
      {error && <div className="viewer-overlay viewer-error">{error}</div>}
      {!pdbId && !loading && (
        <div className="viewer-overlay viewer-empty">
          Enter a PDB ID above to load a protein structure
        </div>
      )}
      <div className="rep-buttons">
        {REPRESENTATIONS.map(r => (
          <button
            key={r.id}
            className={`rep-btn ${rep === r.id ? 'active' : ''}`}
            onClick={() => setRep(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function applyRep(comp, repId) {
  const colorScheme = 'residueindex'
  switch (repId) {
    case 'cartoon':
      comp.addRepresentation('cartoon', { colorScheme })
      break
    case 'surface':
      comp.addRepresentation('surface', { colorScheme, opacity: 0.85 })
      break
    case 'ball+stick':
      comp.addRepresentation('ball+stick', { colorScheme })
      break
    case 'licorice':
      comp.addRepresentation('licorice', { colorScheme })
      break
    default:
      comp.addRepresentation('cartoon', { colorScheme })
  }
}
