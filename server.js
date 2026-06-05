import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import 'dotenv/config'

const app = express()
app.use(cors())
app.use(express.json())

const MOCK_MODE = process.env.MOCK_MODE === 'true'

// Mock responses keyed by rough question intent
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
    `The binding pocket is lined with hydrophobic residues — **Phe41**, **Leu99**, **Val213** — that cradle the substrate. ` +
    `Water molecules mediate several key contacts.\n\n` +
    `Zoom into the cleft in the 3D viewer and switch to **Ball+Stick** mode to see the individual atoms of these residues.`,

  secondary: (protein) =>
    `**${protein?.title || 'This protein'}** displays a rich mix of secondary structure elements:\n\n` +
    `**Alpha helices** — The structure contains roughly 8 α-helices (shown as ribbons in cartoon mode). ` +
    `Helix 3 (residues 45–62) and Helix 7 (residues 140–158) are particularly long and form the scaffold of the hydrophobic core.\n\n` +
    `**Beta sheets** — A central 6-stranded antiparallel β-sheet runs through the middle of the protein. ` +
    `Residues **Val18**, **Ile34**, **Leu52** contribute beta-strands that hydrogen-bond across the sheet.\n\n` +
    `**Loops and turns** — Several flexible loop regions (e.g. residues 88–96) connect the secondary structure elements and often contribute to substrate recognition.\n\n` +
    `Try switching to the **Surface** representation to see how these elements pack together and create the overall shape of the protein.`,

  conserved: (protein) =>
    `Residue conservation reflects evolutionary pressure to maintain function across species.\n\n` +
    `In **${protein?.title || 'this protein'}**, the most conserved residues cluster in two regions:\n\n` +
    `1. **Active site residues** — **His93**, **Glu35**, and **Arg145** are invariant across all known homologues. ` +
    `Any mutation here abolishes activity, which is why evolution has never tolerated it.\n\n` +
    `2. **Structural core** — **Leu41**, **Val78**, **Phe112** are buried hydrophobic residues that drive folding. ` +
    `They're conserved not because of chemistry but because replacing them with polar residues would destabilise the fold.\n\n` +
    `Surface residues, by contrast, vary widely — they're under less constraint and accumulate substitutions over evolutionary time. ` +
    `This pattern (conserved core + variable surface) is a universal feature of globular proteins.`,

  partners: (protein) =>
    `**${protein?.title || 'This protein'}** interacts with several partners in the cell:\n\n` +
    `**Protein–protein interfaces** — The exposed surface around **Lys79**, **Asp84**, and **Glu91** forms a charged patch ` +
    `that docks with partner proteins via complementary electrostatics. These interfaces are typically flat and hydrophobic in the centre, ` +
    `ringed by polar contacts.\n\n` +
    `**Ligand binding** — Small molecules bind deep in the hydrophobic pocket near **Trp59** and **Phe103**. ` +
    `The binding is driven by van der Waals contacts and one key hydrogen bond to **Asn26**.\n\n` +
    `**Cofactors** — Many proteins in this family require a metal ion (often Zn²⁺ or Mg²⁺) coordinated by **His**, **Asp**, ` +
    `and **Cys** residues to complete the active site geometry.\n\n` +
    `Switch to the **Surface** view to visualise these binding patches as concavities or electrostatic hotspots on the molecular surface.`,

  default: (protein, question) =>
    `Great question about **${protein?.title || 'this protein'}**!\n\n` +
    `*(This is a mock response — add Anthropic credits to get real AI answers about "${question}")*\n\n` +
    `The structure (PDB: **${protein?.id || '?'}**) from **${protein?.organism || 'unknown organism'}** ` +
    `was resolved at **${protein?.resolution ? protein.resolution + ' Å' : 'N/A'}** resolution. ` +
    `At this resolution every side chain is clearly resolved, allowing precise identification of functional residues like **His57**, **Asp102**, and **Ser195**.\n\n` +
    `To get a full AI-powered explanation of this specific question, add credits at **console.anthropic.com** → Plans & Billing.`,
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
  // Stream word-by-word with a small delay to simulate typing
  const words = text.split(' ')
  for (const word of words) {
    res.write(`data: ${JSON.stringify({ text: word + ' ' })}\n\n`)
    await new Promise(r => setTimeout(r, 18))
  }
  res.write('data: [DONE]\n\n')
  res.end()
}

const client = MOCK_MODE ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

app.post('/api/chat', async (req, res) => {
  const { question, history, protein } = req.body

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  if (MOCK_MODE) {
    const mockText = pickMockResponse(question, protein)
    return streamMock(res, mockText)
  }

  const systemPrompt = protein
    ? `You are a protein structure expert and educator. A 3D protein structure is currently loaded in the viewer for the user to see.

Protein: ${protein.title || 'Unknown'}
PDB ID: ${protein.id}
Organism: ${protein.organism || 'Unknown'}
Resolution: ${protein.resolution ? protein.resolution + ' Å' : 'N/A'}
Experimental method: ${protein.method || 'Unknown'}
Chain IDs: ${protein.chains?.join(', ') || 'Unknown'}
Description: ${protein.description || 'No description available'}
${protein.keywords ? 'Keywords: ' + protein.keywords : ''}

Answer natural-language questions about this protein's structure, function, and biology. Be precise about structural elements (helices, sheets, loops, binding pockets, residues). Connect structural features to biological function wherever possible. When you mention specific residue numbers (e.g. His93, Lys41), format them exactly like that so they can be highlighted in the viewer. Keep explanations educational but accessible.`
    : `You are a protein structure expert and educator. No protein is currently loaded. Help the user find an interesting protein to load by suggesting PDB IDs and explaining what they can learn from protein structures.`

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ]

  try {
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
})

const PORT = 3001
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}${MOCK_MODE ? ' [MOCK MODE]' : ''}`))
