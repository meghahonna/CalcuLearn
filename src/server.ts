import * as http from 'node:http'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createApp } from './main.js'
import { parseQuantisationOverride } from './bootstrap.js'
import type { CalcuLearnApp } from './main.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

const PORT = Number(process.env.PORT ?? 3000)
const DIST_UI_ROOT = path.join(process.cwd(), 'dist', 'ui')

async function readRequestBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (raw.length === 0) return {}

  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error('Invalid JSON body')
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body)
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(payload, 'utf8')),
  })
  response.end(payload)
}

function sendError(response: ServerResponse, statusCode: number, message: string): void {
  sendJson(response, statusCode, { error: message })
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8'
    case '.js': return 'application/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.json': return 'application/json; charset=utf-8'
    case '.svg': return 'image/svg+xml'
    case '.woff': return 'font/woff'
    case '.woff2': return 'font/woff2'
    case '.ttf': return 'font/ttf'
    case '.eot': return 'application/vnd.ms-fontobject'
    case '.otf': return 'font/otf'
    default: return 'application/octet-stream'
  }
}

async function serveStatic(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<void> {
  const normalized = pathname === '/' ? '/index.html' : pathname
  const requestedPath = path.join(DIST_UI_ROOT, normalized)

  try {
    const resolved = path.resolve(requestedPath)
    if (!resolved.startsWith(path.resolve(DIST_UI_ROOT))) {
      sendError(response, 403, 'Forbidden')
      return
    }

    const data = await fs.readFile(resolved)
    response.writeHead(200, { 'Content-Type': getContentType(resolved) })
    response.end(data)
  } catch (err) {
    sendError(response, 404, 'Not found')
  }
}

function requireString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Expected a non-empty string')
  }
  return value.trim()
}

async function handleApiRequest(app: CalcuLearnApp, request: IncomingMessage, response: ServerResponse, pathname: string): Promise<void> {
  try {
    if (request.method === 'GET' && pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok' })
      return
    }

    if (request.method === 'POST' && pathname === '/api/session/begin') {
      const body = await readRequestBody(request) as Record<string, unknown>
      const studentId = requireString(body.studentId)
      const session = await app.sessionEngine.beginSession(studentId)
      sendJson(response, 200, session)
      return
    }

    const sessionMatch = pathname.match(/^\/api\/session\/([^\/]+)\/(submit|hint|end)$/)
    if (sessionMatch && request.method === 'POST') {
      const [, sessionId, action] = sessionMatch
      if (action === 'submit') {
        const body = await readRequestBody(request) as Record<string, unknown>
        const rawAnswer = requireString(body.rawAnswer)
        const result = await app.sessionEngine.submitAnswer(sessionId, rawAnswer)
        sendJson(response, 200, result)
        return
      }

      if (action === 'hint') {
        const result = await app.sessionEngine.requestHint(sessionId)
        sendJson(response, 200, result)
        return
      }

      // Streaming hint — Server-Sent Events so the UI can render tokens live
      if (action === 'hint-stream') {
        const active = app.sessionEngine.getActiveSession?.(sessionId)
        if (active === undefined) {
          sendError(response, 404, 'Session not found')
          return
        }
        const SEP = '\n\n'
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        })
        try {
          const stream = app.dialogueGenerator.inferStream(
            'Give a Socratic hint for: ' + (active.session.currentProblem?.stem ?? ''),
            'Think about the first step.',
            256
          )
          for await (const token of stream) {
            response.write('data: ' + JSON.stringify({ token }) + SEP)
          }
          response.write('data: [DONE]' + SEP)
        } catch {
          response.write('data: [ERROR]' + SEP)
        }
        response.end()
        return
      }

      if (action === 'end') {
        const result = await app.sessionEngine.endSession(sessionId)
        sendJson(response, 200, result)
        return
      }
    }

    sendError(response, 404, 'Not found')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    sendError(response, 400, message)
  }
}

async function startServer(): Promise<void> {
  const config = {
    dbPath: process.env['DB_PATH'] ?? './data/calculearn.sqlite',
    modelDir: process.env['MODEL_DIR'] ?? './models',
    gemmaHashes: {
      Q4_K_M: process.env['GEMMA_Q4_SHA256'] ?? '',
      Q8: process.env['GEMMA_Q8_SHA256'] ?? '',
    },
    quantisation: parseQuantisationOverride(process.env['GEMMA_QUANTISATION']),
    nllb: process.env['NLLB_SHA256']
      ? { fileName: process.env['NLLB_FILE'] ?? 'nllb-200.gguf', hash: process.env['NLLB_SHA256'] }
      : undefined,
    targetLanguage: process.env['TARGET_LANGUAGE'] ?? 'en',
    inferenceTimeoutMs: process.env['DIALOGUE_TIMEOUT_MS']
      ? Number(process.env['DIALOGUE_TIMEOUT_MS'])
      : undefined,
  }

  // Phase 1: createApp() now warms up Gemma before returning.
  // The server only starts listening once the model is fully loaded,
  // so the first student request is never the cold-load request.
  const app = await createApp(config)

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
    const pathname = url.pathname

    if (pathname.startsWith('/api/')) {
      void handleApiRequest(app, request, response, pathname)
      return
    }

    void serveStatic(request, response, pathname)
  })

  server.listen(PORT, () => {
    console.log(`[server] CalcuLearn backend running at http://localhost:${PORT}`)
    console.log(`[server] Serving static UI from ${DIST_UI_ROOT}`)
    console.log(`[server] Gemma is warm — ready to accept student sessions`)
  })

  const cleanup = (): void => {
    server.close()
    app.close()
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  startServer().catch((err) => {
    console.error('[server] startup failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
}
