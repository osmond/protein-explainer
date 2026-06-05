import Anthropic from '@anthropic-ai/sdk'

const MOCK_MODE = process.env.MOCK_MODE === 'true'

const MOCK_RESPONSES = {
  function: (protein) =>
    `**${protein?.title || 'This protein'}** (PDB: ${protein?.id || '?'}) is a fascinating molecular machine.\n\n` +
    `It belongs to a class of proteins that carry out essential biological functions in ${protein?.organism || 'the organism'}. ` +
    `The structure was solved to ${protein?.resolution ? protein.resolution + ' Å' : 'high'} resolution by ${protein?.method || 'X-ray crystallography'}, ` +
    `giving us atomic-level detail of every residue.\n\n` +
    `Key functional residues include **His93**, **Lys41**, and **Asp102**, which form the core of the active site. ` +
    `The protein folds into a compact globular structure stabilised by hydrophobic interactions in the core and salt bridges on the surface. ` +
    `Chain ${protein?.chains?.[0] || 'A'} contributes the primary binding interface.\n\n` +
    `Understanding this structure helps explain how small molecules bind, how mutations cause disease, and how inhibitors could be designed.`,

  activesite: (protein) =>
    `The active site of **${protein?.title || 'this protein'}** is located in a deep cleft between the two major domains.\n\n` +
    `Three catalytic residues are critical:\n` +
    `- **His57** acts as a general base, abstracting a proton during catalysis\n` +
    `- **Asp102** stabilises the positive charge on His57 via hydrogen bonding\n` +
    `- **Ser195** forms the covalent intermediate with the substrate\n\n` +
    `This **catalytic triad** (His57–Asp102–Ser195) is one of the most studied arrangements in biochemistry. ` +
    `The binding pocket is lined with hydrophobic residues — **Phe41**, **Leu99**, **Val213** — that cradle the substrate.\n\n` +
    `Switch to **Ball+Stick** mode in the viewer to see the individual atoms of these residues.`,

  secondary: (protein) =>
    `**${protein?.title || 'This protein'}** displays a rich mix of secondary structure elements:\n\n` +
    `**Alpha helices** — The structure contains roughly 8 α-helices. ` +
    `Helix 3 (residues 45–62) and Helix 7 (residues 140–158) form the scaffold of the hydrophobic core.\n\n` +
    `**Beta sheets** — A central 6-stranded antiparallel β-sheet runs through the middle of the protein. ` +
    `Residues **Val18**, **Ile34**, **Leu52** contribute beta-strands that hydrogen-bond across the sheet.\n\n` +
    `**Loops and turns** — Flexible loop regions (e.g. residues 88–96) connect the secondary elements and often contribute to substrate recognition.\n\n` +
    `Try switching to the **Surface** representation to see how these elements pack together.`,

  conserved: (protein) =>
    `Residue conservation reflects evolutionary pressure to maintain function across species.\n\n` +
    `In **${protein?.title || 'this protein'}**, the most conserved residues cluster in two regions:\n\n` +
    `1. **Active site residues** — **His93**, **Glu35**, and **Arg145** are invariant across all known homologues. ` +
    `Any mutation here abolishes activity.\n\n` +
    `2. **Structural core** — **Leu41**, **Val78**, **Phe112** are buried hydrophobic residues that drive folding. ` +
    `They're conserved because replacing them with polar residues would destabilise the entire fold.\n\n` +
    `Surface residues vary widely — they're under less constraint and accumulate substitutions over evolutionary time.`,

  partners: (protein) =>
    `**${protein?.title || 'This protein'}** interacts with several partners in the cell:\n\n` +
    `**Protein–protein interfaces** — The exposed surface around **Lys79**, **Asp84**, and **Glu91** forms a charged patch ` +
    `that docks with partner proteins via complementary electrostatics.\n\n` +
    `**Ligand binding** — Small molecules bind deep in the hydrophobic pocket near **Trp59** and **Phe103**. ` +
    `The binding is driven by van der Waals contacts and one key hydrogen bond to **Asn26**.\n\n` +
    `**Cofactors** — Many proteins in this family require a metal ion (Zn²⁺ or Mg²⁺) coordinated by **His**, **Asp**, ` +
    `and **Cys** residues to complete the active site geometry.\n\n` +
    `Switch to **Surface** view to visualise the binding patches as concavities on the molecular surface.`,

  default: (protein, question) =>
    `Great question about **${protein?.title || 'this protein'}**!\n\n` +
    `*(This is a mock response — add an Anthropic API key to get real AI answers about "${question}")*\n\n` +
    `The structure (PDB: **${protein?.id || '?'}**) from **${protein?.organism || 'unknown organism'}** ` +
    `was resolved at **${protein?.resolution ? protein.resolution + ' Å' : 'N/A'}** resolution. ` +
    `At this resolution every side chain is clearly resolved, allowing precise identification of functional residues like **His57**, **Asp102**, and **Ser195**.`,
}

function pickMockResponse(question, protein) {
  const q = question.toLowerCase()
  if (q.includes('do') || q.includes('function') || q.includes('what is')) return MOCK_RESPONSES.function(protein)
  if (q.includes('active site') || q.includes('binding')) return MOCK_RESPONSES.activesite(protein)
  if (q.includes('secondary') || q.includes('helix') || q.includes('sheet') || q.includes('structure')) return MOCK_RESPONSES.secondary(protein)
  if (q.includes('conserved') || q.includes('evolution') || q.includes('mutation')) return MOCK_RESPONSES.conserved(protein)
  if (q.includes('interact') || q.includes('partner') || q.includes('bind')) return MOCK_RESPONSES.partners(protein)
  return MOCK_RESPONSES.default(protein, question)
}

async function streamMock(res, text) {
  const words = text.split(' ')
  for (const word of words) {
    res.write(`data: ${JSON.stringify({ text: word + ' ' })}\n\n`)
    await new Promise(r => setTimeout(r, 18))
  }
  res.write('data: [DONE]\n\n')
  res.end()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { question, history, protein } = req.body

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  if (MOCK_MODE) {
    const mockText = pickMockResponse(question, protein)
    return streamMock(res, mockText)
  }

  const systemPrompt = protein
    ? `You are a protein structure expert and educator. A 3D protein structure is currently loaded in the viewer.

Protein: ${protein.title || 'Unknown'}
PDB ID: ${protein.id}
Organism: ${protein.organism || 'Unknown'}
Resolution: ${protein.resolution ? protein.resolution + ' Å' : 'N/A'}
Experimental method: ${protein.method || 'Unknown'}
Chain IDs: ${protein.chains?.join(', ') || 'Unknown'}
Description: ${protein.description || 'No description available'}
${protein.keywords ? 'Keywords: ' + protein.keywords : ''}

Answer natural-language questions about this protein's structure, function, and biology. Be precise about structural elements (helices, sheets, loops, binding pockets, residues). When you mention specific residue numbers (e.g. His93, Lys41), format them exactly like that so they can be highlighted in the viewer. Keep explanations educational but accessible.`
    : `You are a protein structure expert. No protein is loaded. Help the user find an interesting protein to explore by suggesting PDB IDs.`

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ]

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Claude error:', err.message)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
}
