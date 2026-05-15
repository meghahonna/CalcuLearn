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

    // -------------------- Phase B: Learn Mode endpoints --------------------

    // List concept ids that have authored content (for the topic picker)
    if (request.method === 'GET' && pathname === '/api/learn/concepts') {
      const ids = app.contentRetrieval.listAuthoredConceptIds()
      const concepts = ids
        .map((id) => app.contentRetrieval.getConcept(id))
        .filter((c) => c !== null)
        .map((c) => ({
          id: c!.id,
          name: c!.name,
          one_liner: c!.one_liner,
          track: c!.track,
          prerequisites: c!.prerequisites,
          difficulty: c!.difficulty,
        }))
      sendJson(response, 200, { concepts })
      return
    }

    // Start a new Learn Mode walkthrough
    if (request.method === 'POST' && pathname === '/api/learn/start') {
      const body = (await readRequestBody(request)) as Record<string, unknown>
      const studentId = requireString(body['studentId'])
      const conceptId = requireString(body['conceptId'])
      const tier = (body['tier'] as 'novice' | 'on_pace' | 'advanced' | undefined) ?? undefined
      const turn = await app.learnModeService.start({ studentId, conceptId, tier })
      sendJson(response, 200, turn)
      return
    }

    // Continue an existing Learn Mode walkthrough
    if (request.method === 'POST' && pathname.startsWith('/api/learn/respond/')) {
      const sessionId = pathname.replace('/api/learn/respond/', '')
      const body = (await readRequestBody(request)) as Record<string, unknown>
      const studentInput = requireString(body['studentInput'])
      const turn = await app.learnModeService.respond({ sessionId, studentInput })
      sendJson(response, 200, turn)
      return
    }

    // Inspect Learn session state
    if (request.method === 'GET' && pathname.startsWith('/api/learn/session/')) {
      const sessionId = pathname.replace('/api/learn/session/', '')
      const sess = app.learnModeService.getSession(sessionId)
      if (!sess) {
        sendError(response, 404, 'Learn session not found')
        return
      }
      sendJson(response, 200, {
        id: sess.id,
        studentId: sess.studentId,
        conceptId: sess.conceptId,
        conceptName: sess.conceptName,
        tier: sess.tier,
        stage: sess.stage,
        currentFramingIndex: sess.currentFramingIndex,
        checkIndex: sess.checkIndex,
        framingsExhausted: sess.framingsExhausted,
        turns: sess.turns,
        startedAt: sess.startedAt,
      })
      return
    }

    // -------------------- Phase D: Adaptive Routing --------------------

    // Record a self-reported confidence chip after a Practice problem
    if (request.method === 'POST' && pathname === '/api/practice/confidence') {
      const body = (await readRequestBody(request)) as Record<string, unknown>
      const studentId = requireString(body['studentId'])
      const conceptId = requireString(body['conceptId'])
      const confidence = requireString(body['confidence']) as 'got_it' | 'guessed' | 'shaky'
      if (!['got_it', 'guessed', 'shaky'].includes(confidence)) {
        sendError(response, 400, `Invalid confidence: \${confidence}`)
        return
      }
      const sig = app.adaptiveRouter.recordConfidence({ studentId, conceptId, confidence })
      sendJson(response, 200, {
        archetype: sig.archetype,
        challengeUnlocked: sig.challengeUnlocked,
      })
      return
    }

    // Get a routing suggestion (e.g., open Learn Mode? unlock Challenge?)
    if (request.method === 'GET' && pathname.startsWith('/api/adaptive/suggestion')) {
      const url = new URL(request.url ?? '/', `http://\${request.headers.host}`)
      const studentId = url.searchParams.get('studentId') ?? ''
      const conceptId = url.searchParams.get('conceptId') ?? ''
      if (!studentId || !conceptId) {
        sendError(response, 400, 'studentId and conceptId required')
        return
      }
      const suggestion = app.adaptiveRouter.suggest(studentId, conceptId)
      sendJson(response, 200, suggestion)
      return
    }

    // Get the full per-concept signal profile for a student (UI dashboard)
    if (request.method === 'GET' && pathname.startsWith('/api/adaptive/profile')) {
      const url = new URL(request.url ?? '/', `http://\${request.headers.host}`)
      const studentId = url.searchParams.get('studentId') ?? ''
      if (!studentId) {
        sendError(response, 400, 'studentId required')
        return
      }
      const signals = app.adaptiveRouter.listSignalsForStudent(studentId)
      sendJson(response, 200, {
        signals: signals.map((s) => ({
          conceptId: s.conceptId,
          archetype: s.archetype,
          challengeUnlocked: s.challengeUnlocked,
          practiceAttempts: s.practiceAttempts,
          practiceCorrect: s.practiceCorrect,
          accuracy: s.practiceAttempts > 0
            ? s.practiceCorrect / s.practiceAttempts
            : null,
          consecutiveAces: s.consecutiveAces,
          consecutiveFailures: s.consecutiveFailures,
          dontKnowCount: s.dontKnowCount,
          learnEngagements: s.learnEngagements,
          learnCompletions: s.learnCompletions,
          lastConfidence: s.lastConfidence,
          updatedAt: s.updatedAt,
        })),
      })
      return
    }

    // -------------------- Phase E: Challenge Mode --------------------

    // List concepts that have challenge content available
    if (request.method === 'GET' && pathname.startsWith('/api/challenge/concepts')) {
      const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
      const studentId = url.searchParams.get('studentId') ?? ''
      if (!studentId) {
        sendError(response, 400, 'studentId required')
        return
      }
      const concepts = app.challengeService.listChallengeableConcepts(studentId)
      sendJson(response, 200, { concepts })
      return
    }

    // Get the full challenge bundle for one concept
    if (request.method === 'GET' && pathname.startsWith('/api/challenge/bundle')) {
      const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
      const studentId = url.searchParams.get('studentId') ?? ''
      const conceptId = url.searchParams.get('conceptId') ?? ''
      if (!studentId || !conceptId) {
        sendError(response, 400, 'studentId and conceptId required')
        return
      }
      const bundle = app.challengeService.getChallengeBundle(studentId, conceptId)
      sendJson(response, 200, bundle)
      return
    }

    // Socratic feedback on an application-problem answer
    if (request.method === 'POST' && pathname === '/api/challenge/application/feedback') {
      const body = (await readRequestBody(request)) as Record<string, unknown>
      const applicationId = Number(body['applicationId'])
      const studentAnswer = requireString(body['studentAnswer'])
      if (!applicationId || Number.isNaN(applicationId)) {
        sendError(response, 400, 'applicationId required')
        return
      }
      const fb = await app.challengeService.feedbackOnApplication({
        applicationId,
        studentAnswer,
      })
      sendJson(response, 200, fb)
      return
    }

    // Socratic probe after a deep-dive reflection
    if (request.method === 'POST' && pathname === '/api/challenge/deepdive/probe') {
      const body = (await readRequestBody(request)) as Record<string, unknown>
      const deepDiveId = Number(body['deepDiveId'])
      const studentReflection = (body['studentReflection'] as string) ?? ''
      if (!deepDiveId || Number.isNaN(deepDiveId)) {
        sendError(response, 400, 'deepDiveId required')
        return
      }
      const fb = await app.challengeService.probeAfterDeepDive({
        deepDiveId,
        studentReflection,
      })
      sendJson(response, 200, fb)
      return
    }

    // -------------------- A1: Visuals --------------------

    // List visuals for a concept (optionally filtered by slot or tier)
    if (request.method === 'GET' && pathname === '/api/visuals/list') {
      const vUrl = new URL(request.url ?? '/', `http://${request.headers.host}`)
      const conceptId = vUrl.searchParams.get('conceptId')
      if (!conceptId) {
        sendError(response, 400, 'Missing conceptId')
        return
      }
      const slot = vUrl.searchParams.get('slot')
      const tier = vUrl.searchParams.get('tier')
      let rows
      if (slot) {
        rows = app.visualRetrieval.listForConceptAndSlot(conceptId, slot)
      } else if (tier) {
        rows = app.visualRetrieval.listForConceptAndTier(conceptId, tier)
      } else {
        rows = app.visualRetrieval.listForConcept(conceptId)
      }
      sendJson(response, 200, { conceptId, visuals: rows })
      return
    }

    // -------------------- A3: Explore Mode --------------------

    // Start a new explore session
    if (request.method === 'POST' && pathname === '/api/explore/start') {
      const body = (await readRequestBody(request)) as Record<string, unknown>
      const studentId = requireString(body['studentId'])
      const r = app.exploreService.start(studentId)
      sendJson(response, 200, r)
      return
    }

    // Ask a question
    if (request.method === 'POST' && pathname.startsWith('/api/explore/ask/')) {
      const sessionId = pathname.replace('/api/explore/ask/', '')
      const body = (await readRequestBody(request)) as Record<string, unknown>
      const question = requireString(body['question'])
      const pinConceptId = typeof body['pinConceptId'] === 'string'
        ? (body['pinConceptId'] as string)
        : null
      const r = await app.exploreService.ask(sessionId, question, { pinConceptId })
      sendJson(response, 200, r)
      return
    }

    // Inspect a session
    if (request.method === 'GET' && pathname.startsWith('/api/explore/session/')) {
      const sessionId = pathname.replace('/api/explore/session/', '')
      const sess = app.exploreService.getSession(sessionId)
      if (!sess) {
        sendError(response, 404, 'Explore session not found')
        return
      }
      sendJson(response, 200, {
        id: sess.id,
        studentId: sess.studentId,
        currentConceptId: sess.currentConceptId,
        turns: sess.turns,
        createdAt: sess.createdAt,
      })
      return
    }

    // -------------------- A2: Teach It Back (Feynman) --------------------

    // Start a teach-back: app prompts the student to explain the concept
    if (request.method === 'POST' && pathname === '/api/teachback/start') {
      const body = (await readRequestBody(request)) as Record<string, unknown>
      const studentId = requireString(body['studentId'])
      const conceptId = requireString(body['conceptId'])
      const tier =
        (body['tier'] as 'novice' | 'on_pace' | 'advanced' | undefined) ?? undefined
      const r = await app.teachBackService.start({ studentId, conceptId, tier })
      sendJson(response, 200, r)
      return
    }

    // Continue a teach-back with the student's explanation
    if (request.method === 'POST' && pathname.startsWith('/api/teachback/respond/')) {
      const sessionId = pathname.replace('/api/teachback/respond/', '')
      const body = (await readRequestBody(request)) as Record<string, unknown>
      const studentExplanation = requireString(body['studentExplanation'])
      const r = await app.teachBackService.respond({ sessionId, studentExplanation })
      sendJson(response, 200, r)
      return
    }

    // Force the final assessment + recommendations
    if (request.method === 'POST' && pathname.startsWith('/api/teachback/assess/')) {
      const sessionId = pathname.replace('/api/teachback/assess/', '')
      const r = await app.teachBackService.assess(sessionId)
      sendJson(response, 200, r)
      return
    }

    // Inspect a teach-back session
    if (request.method === 'GET' && pathname.startsWith('/api/teachback/session/')) {
      const sessionId = pathname.replace('/api/teachback/session/', '')
      const sess = app.teachBackService.getSession(sessionId)
      if (!sess) {
        sendError(response, 404, 'Teach-back session not found')
        return
      }
      sendJson(response, 200, {
        id: sess.id,
        studentId: sess.studentId,
        conceptId: sess.conceptId,
        conceptName: sess.conceptName,
        tier: sess.tier,
        stage: sess.stage,
        probeCount: sess.probeCount,
        maxProbes: sess.maxProbes,
        facets: sess.facets,
        turns: sess.turns,
        startedAt: sess.startedAt,
      })
      return
    }

    sendError(response, 404, 'Not found')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Log full stack so we can diagnose crashes
    console.error('[server] Request error:', err instanceof Error ? err.stack : err)
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
