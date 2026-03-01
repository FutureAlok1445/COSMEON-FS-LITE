---
name: NotebookLM Research
description: How to use Google NotebookLM for AI-powered research, source analysis, and knowledge synthesis
---

# NotebookLM Research Skill

## What is NotebookLM?

Google NotebookLM is an AI-powered research assistant that lets you upload sources (PDFs, websites, YouTube videos, Google Docs, text files) and ask questions grounded in those sources. It provides **cited, source-grounded answers** — meaning every claim links back to the original material.

**URL**: https://notebooklm.google.com

## Core Capabilities

| Feature | Description |
|---------|-------------|
| **Source Ingestion** | Upload PDFs, paste URLs, add YouTube links, import Google Docs/Slides, paste raw text |
| **Grounded Q&A** | Ask questions and get answers with inline citations pointing to exact source passages |
| **Audio Overview** | Generate a podcast-style audio discussion of your sources (two AI hosts) |
| **Study Guides** | Auto-generate study guides, FAQs, timelines, and briefing docs |
| **Notes & Pinning** | Save important AI responses as notes, pin key findings |
| **Multi-Notebook** | Organize research across multiple notebooks by topic/project |

## Research Workflow

### Step 1: Create a Notebook
1. Go to https://notebooklm.google.com
2. Click **"New Notebook"**
3. Give it a descriptive title (e.g., "Distributed File Systems Research" or "Orbital Mechanics Papers")

### Step 2: Add Sources
Add up to **50 sources** per notebook. Supported types:
- **PDF files** — Upload research papers, textbooks, reports
- **Website URLs** — Paste any public webpage
- **YouTube URLs** — Paste video links (transcripts are extracted)
- **Google Docs/Slides** — Import directly from Drive
- **Pasted text** — Copy-paste raw text content

> **Tip**: For best results, add 3-10 high-quality, focused sources rather than dumping everything.

### Step 3: Ask Research Questions
Use the chat interface to query your sources:

**Good research prompts:**
- "Compare the approaches to file chunking described in sources 1 and 3"
- "What are the key challenges of inter-satellite communication mentioned across all sources?"
- "Summarize the Reed-Solomon error correction approach from the uploaded paper"
- "Create a table comparing the pros and cons of each distributed storage strategy"
- "What gaps exist in the current research on orbital file systems?"

### Step 4: Generate Outputs
- **Study Guide**: Click "Study Guide" to get a structured overview
- **FAQ**: Generate frequently asked questions from the material
- **Timeline**: Create chronological summaries
- **Audio Overview**: Generate a ~10 min podcast-style discussion
- **Briefing Doc**: Get an executive summary of all sources

### Step 5: Save & Export
- **Pin** important responses as notes within the notebook
- **Copy** generated content for use in reports, code comments, or documentation
- **Share** notebooks with collaborators

## Best Practices

### Source Selection
- Prefer **primary sources** (papers, official docs) over secondary summaries
- Include **contrasting viewpoints** to get balanced analysis
- Add your **own project docs** (README, design docs) for project-specific research

### Prompt Engineering for Research
- Be **specific**: "What algorithm does paper X use for chunk distribution?" > "Tell me about chunking"
- Ask for **comparisons**: "Compare X and Y approaches across these dimensions: performance, reliability, complexity"
- Request **structured output**: "Create a table of...", "List the top 5...", "Give me a step-by-step..."
- Use **follow-up questions**: Build on previous answers to go deeper

### Integration with COSMEON FS-LITE
Use NotebookLM to research:
- **Distributed file systems**: HDFS, Ceph, GlusterFS architectures
- **Erasure coding**: Reed-Solomon, fountain codes, raptor codes
- **Satellite communication**: DTN protocols, inter-satellite links, orbital mechanics
- **Consensus algorithms**: Raft, PBFT, gossip protocols
- **Data integrity**: Merkle trees, hash chains, CRC checksums

## Limitations
- No real-time web access (sources must be explicitly added)
- 50 source limit per notebook
- Works best with English-language sources
- Cannot execute code or access external APIs
- Audio Overviews are English-only with limited customization
