/**
 * Offline-bundle script for CalcuLearn.
 *
 * Produces a self-contained `dist/` directory runnable without internet:
 *   - `dist/models/` — Gemma + NLLB GGUF files
 *   - `dist/data/`   — seeded SQLite problem bank
 *   - `dist/ui/`     — index.html + compiled app.js + bundled KaTeX assets
 *
 * Requires `npm run build` to have produced compiled JS in `dist/`.
 *
 * Requirements: 7.1, 7.2, 7.3, 14.2
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'dist')

function copyIfExists(from: string, to: string, label: string): void {
  if (!fs.existsSync(from)) {
    console.warn(`[bundle] skipping ${label}: ${from} does not exist`)
    return
  }
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, { recursive: true })
  console.log(`[bundle] copied ${label}: ${from} → ${to}`)
}

fs.mkdirSync(dist, { recursive: true })

// 1. Models and seeded data.
copyIfExists(path.join(root, 'models'), path.join(dist, 'models'), 'models')
copyIfExists(path.join(root, 'data'), path.join(dist, 'data'), 'data')

// 2. UI shell.
copyIfExists(path.join(root, 'src', 'ui', 'index.html'), path.join(dist, 'ui', 'index.html'), 'ui index.html')

// 3. KaTeX dist (Req 14.2: bundled, offline). Copy css, js, and the fonts/
//    directory so the UI renders math without any network call.
const katexSrc = path.join(root, 'node_modules', 'katex', 'dist')
const katexDist = path.join(dist, 'ui', 'katex')
if (fs.existsSync(katexSrc)) {
  fs.mkdirSync(katexDist, { recursive: true })
  for (const entry of ['katex.min.css', 'katex.min.js']) {
    copyIfExists(path.join(katexSrc, entry), path.join(katexDist, entry), `katex/${entry}`)
  }
  copyIfExists(path.join(katexSrc, 'fonts'), path.join(katexDist, 'fonts'), 'katex/fonts')
} else {
  console.warn(`[bundle] KaTeX not installed at ${katexSrc}; run "npm install" first`)
}

// 4. Compiled app.js (from `npm run build` → dist/ui/app.js).
//    The TS compiler outputs `dist/ui/app.js` directly when src/ui/app.ts is
//    included by tsconfig.json (which it is via "include": ["src/**/*"]).
//    No copy needed — index.html references `./app.js` relative to itself.
const compiledApp = path.join(dist, 'ui', 'app.js')
if (!fs.existsSync(compiledApp)) {
  console.warn(
    `[bundle] ${compiledApp} not found. Run "npm run build" before "npm run bundle" so the UI controller is compiled.`
  )
}

console.log(`[bundle] Created offline bundle at ${dist}`)
