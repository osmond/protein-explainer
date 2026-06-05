import { useEffect, useRef, useState } from 'react'
import * as NGL from 'ngl'

const REPRESENTATIONS = [
  { id: 'cartoon',    label: 'Cartoon' },
  { id: 'surface',    label: 'Surface' },
  { id: 'ball+stick', label: 'Ball+Stick' },
  { id: 'licorice',   label: 'Licorice' },
]

const COLOR_SCHEMES = [
  { id: 'residueindex',   label: 'Rainbow' },
  { id: 'sstruc',         label: 'Structure' },
  { id: 'hydrophobicity', label: 'Hydrophob.' },
  { id: 'bfactor',        label: 'B-factor' },
  { id: 'chainindex',     label: 'Chain' },
]

export default function ProteinViewer({ pdbId, highlights, onResidueClick }) {
  const containerRef = useRef(null)
  const stageRef     = useRef(null)
  const compRef      = useRef(null)
  const [rep,         setRep]         = useState('cartoon')
  const [colorScheme, setColorScheme] = useState('residueindex')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [showTip,     setShowTip]     = useState(
    !localStorage.getItem('ngl-controls-seen')
  )

  // Init NGL stage — ResizeObserver keeps it in sync with panel resizing
  useEffect(() => {
    const stage = new NGL.Stage(containerRef.current, {
      backgroundColor: '#08040E',
      quality: 'medium',
    })
    stageRef.current = stage

    const ro = new ResizeObserver(() => stage.handleResize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      stage.dispose()
    }
  }, [])

  // Click-picking → ask Claude about the residue
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    function onPick(pp) {
      if (pp?.atom && onResidueClick) {
        onResidueClick({
          resname: pp.atom.resname,
          resno:   String(pp.atom.resno),
          chain:   pp.atom.chainname,
        })
      }
    }
    stage.signals.clicked.add(onPick)
    return () => stage.signals.clicked.remove(onPick)
  }, [onResidueClick])

  // Controls tooltip — auto-dismiss after 5 s
  useEffect(() => {
    if (!showTip) return
    const t = setTimeout(() => {
      setShowTip(false)
      localStorage.setItem('ngl-controls-seen', '1')
    }, 5000)
    return () => clearTimeout(t)
  }, [showTip])

  // Load structure when pdbId changes
  useEffect(() => {
    if (!pdbId || !stageRef.current) return
    setLoading(true)
    setError(null)
    const stage = stageRef.current
    stage.removeAllComponents()
    compRef.current = null

    stage.loadFile(`https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`, {
      ext: 'pdb', name: pdbId,
    })
      .then(comp => {
        compRef.current = comp
        applyRep(comp, rep, colorScheme)
        comp.autoView(1000) // animated fly-in
        setLoading(false)
        if (!localStorage.getItem('ngl-controls-seen')) setShowTip(true)
      })
      .catch(() => {
        setError(`Could not load ${pdbId} — check the PDB ID.`)
        setLoading(false)
      })
  }, [pdbId])

  // Update representation / color scheme
  useEffect(() => {
    const comp = compRef.current
    if (!comp) return
    comp.removeAllRepresentations()
    applyRep(comp, rep, colorScheme)
  }, [rep, colorScheme])

  // Highlight residues from Claude + fly camera to them
  useEffect(() => {
    const comp = compRef.current
    if (!comp) return
    comp.reprList
      .filter(r => r.name === 'highlight')
      .forEach(r => comp.removeRepresentation(r))

    if (!highlights.length) return
    const sele = highlights.map(r => `${r.resno}${r.chain ? ':' + r.chain : ''}`).join(' or ')
    if (sele) {
      comp.addRepresentation('ball+stick', {
        sele,
        colorValue: '#DBA8EF',
        name: 'highlight',
        radius: 0.4,
      })
      comp.autoView(sele, 1200) // fly to highlighted residues
    }
  }, [highlights])

  return (
    <>
      <div className="viewer-wrapper">
        <div ref={containerRef} className="ngl-container" />

        {loading && <div className="viewer-overlay">Loading {pdbId}…</div>}
        {error   && <div className="viewer-overlay viewer-error">{error}</div>}
        {!pdbId && !loading && (
          <div className="viewer-overlay viewer-empty">
            Enter a PDB ID above to load a protein structure
          </div>
        )}

        {showTip && pdbId && (
          <div className="controls-tooltip">
            <span>Drag to rotate</span>
            <span className="tip-dot">·</span>
            <span>Scroll to zoom</span>
            <span className="tip-dot">·</span>
            <span>Right-click to pan</span>
            <span className="tip-dot">·</span>
            <span>Click atom to ask</span>
          </div>
        )}
      </div>

      <div className="viewer-controls">
        <div className="controls-row">
          <span className="controls-label">View</span>
          {REPRESENTATIONS.map(r => (
            <button
              key={r.id}
              className={`ctrl-btn ${rep === r.id ? 'active' : ''}`}
              onClick={() => setRep(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="controls-divider" />
        <div className="controls-row">
          <span className="controls-label">Color</span>
          {COLOR_SCHEMES.map(c => (
            <button
              key={c.id}
              className={`ctrl-btn ${colorScheme === c.id ? 'active' : ''}`}
              onClick={() => setColorScheme(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function applyRep(comp, repId, colorScheme) {
  const cs = colorScheme || 'residueindex'
  switch (repId) {
    case 'surface':    comp.addRepresentation('surface',    { colorScheme: cs, opacity: 0.85 }); break
    case 'ball+stick': comp.addRepresentation('ball+stick', { colorScheme: cs }); break
    case 'licorice':   comp.addRepresentation('licorice',   { colorScheme: cs }); break
    default:           comp.addRepresentation('cartoon',    { colorScheme: cs })
  }
}
