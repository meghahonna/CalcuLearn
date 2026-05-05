/**
 * Computes SHA-256 hashes for every GGUF file in `models/` and prints them as
 * shell-export lines, ready to paste into `.env` or your shell rc.
 *
 * Usage:
 *   npm run hash           # scans ./models/
 *   npm run hash -- <dir>  # scans a custom directory
 *
 * Example output:
 *   GEMMA_Q4_SHA256=4f3c… (gemma4-e4b-Q4_K_M.gguf)
 *   GEMMA_Q8_SHA256=ab10… (gemma4-e4b-Q8.gguf)
 *   NLLB_SHA256=8e2f…    (nllb-200.gguf)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { sha256File } from '../src/security/modelVerifier.js'

const dir = path.resolve(process.argv[2] ?? './models')

if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error(`[hash] not a directory: ${dir}`)
  process.exit(1)
}

const files = fs.readdirSync(dir).filter((name) => name.endsWith('.gguf')).sort()
if (files.length === 0) {
  console.error(`[hash] no .gguf files in ${dir}`)
  process.exit(1)
}

console.log(`# SHA-256 hashes for ${dir}`)
console.log(`# Paste these into .env or export in your shell, then \`npm start\`.`)
console.log()

for (const name of files) {
  const fullPath = path.join(dir, name)
  const hash = await sha256File(fullPath)
  let envName: string
  if (name.includes('Q4_K_M')) envName = 'GEMMA_Q4_SHA256'
  else if (name.includes('Q8')) envName = 'GEMMA_Q8_SHA256'
  else if (name.toLowerCase().includes('nllb')) envName = 'NLLB_SHA256'
  else envName = `# ${name.replace(/\W+/g, '_').toUpperCase()}_SHA256`
  console.log(`${envName}=${hash}  # ${name}`)
}
