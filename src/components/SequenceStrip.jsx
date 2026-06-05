import { useEffect, useState } from 'react'

// Amino acid color categories (biochemistry standard)
const AA_COLOR = {
  F:'#E8A020', W:'#E8A020', Y:'#E8A020',          // aromatic — orange
  K:'#5599FF', R:'#5599FF', H:'#8899EE',           // positive — blue
  D:'#EE4444', E:'#EE4444',                         // negative — red
  S:'#44BB44', T:'#44BB44', N:'#44BB44', Q:'#44BB44', // polar — green
  C:'#DDCC22',                                      // cysteine — yellow
  G:'#999999', A:'#AAAAAA', V:'#999999',           // nonpolar — gray
  L:'#AAAAAA', I:'#AAAAAA', P:'#BB8855', M:'#AAAAAA',
}
const DEFAULT_COLOR = '#777777'

const LETTER_TO_3 = {
  A:'Ala',R:'Arg',N:'Asn',D:'Asp',C:'Cys',E:'Glu',Q:'Gln',
  G:'Gly',H:'His',I:'Ile',L:'Leu',K:'Lys',M:'Met',F:'Phe',
  P:'Pro',S:'Ser',T:'Thr',W:'Trp',Y:'Tyr',V:'Val',
}

const MAX_SHOWN = 500

export default function SequenceStrip({ pdbId, chain, highlights, onResidueClick }) {
  const [seq,     setSeq]     = useState('')
  const [authIds, setAuthIds] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!pdbId) { setSeq(''); setAuthIds([]); return }
    const id      = pdbId.toLowerCase()
    const chainId = chain || 'A'
    setLoading(true)

    Promise.all([
      fetch(`https://data.rcsb.org/rest/v1/core/polymer_entity/${id}/1`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`https://data.rcsb.org/rest/v1/core/polymer_entity_instance/${id}/${chainId}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([entity, instance]) => {
      const s = (
        entity?.entity_poly?.pdbx_seq_one_letter_code_can ||
        entity?.entity_poly?.pdbx_seq_one_letter_code || ''
      ).replace(/\s/g, '')
      const ids = instance
        ?.rcsb_polymer_entity_instance_container_identifiers
        ?.auth_seq_id || []
      setSeq(s)
      setAuthIds(ids)
      setLoading(false)
    })
  }, [pdbId, chain])

  if (!pdbId) return null
  if (loading) return <div className="sequence-strip sequence-strip--loading">Loading sequence…</div>
  if (!seq)    return null

  const highlightedSet = new Set(highlights.map(h => String(h.resno)))
  const display = seq.slice(0, MAX_SHOWN)

  return (
    <div className="sequence-strip">
      <div className="sequence-scroll">
        {display.split('').map((letter, i) => {
          const resno      = authIds[i] !== undefined ? String(authIds[i]) : String(i + 1)
          const highlighted = highlightedSet.has(resno)
          return (
            <div
              key={i}
              className={`seq-res${highlighted ? ' seq-res--hi' : ''}`}
              style={{ '--c': AA_COLOR[letter] || DEFAULT_COLOR }}
              title={`${LETTER_TO_3[letter] || letter}${resno} · chain ${chain || 'A'}`}
              onClick={() => onResidueClick?.({
                resname: LETTER_TO_3[letter] || letter,
                resno,
                chain: chain || 'A',
              })}
            >
              {letter}
            </div>
          )
        })}
        {seq.length > MAX_SHOWN && (
          <span className="seq-more">+{seq.length - MAX_SHOWN}</span>
        )}
      </div>
    </div>
  )
}
