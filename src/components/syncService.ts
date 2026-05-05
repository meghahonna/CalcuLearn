import type { SessionSummary } from '../models/types.js'

export interface SyncTransport {
  post(url: string, payload: unknown, headers: Record<string, string>): Promise<void>
}

export interface KeychainProvider {
  getToken(): Promise<string>
}

export interface SyncServiceOptions {
  endpoint: string
  transport: SyncTransport
  keychain: KeychainProvider
  optIn: boolean
}

export class SyncService {
  private readonly endpoint: string
  private readonly transport: SyncTransport
  private readonly keychain: KeychainProvider
  private readonly optIn: boolean

  constructor(options: SyncServiceOptions) {
    this.endpoint = options.endpoint
    this.transport = options.transport
    this.keychain = options.keychain
    this.optIn = options.optIn
  }

  async syncSession(studentId: string, summary: SessionSummary): Promise<boolean> {
    if (!this.optIn) return false
    const token = await this.keychain.getToken()
    await this.transport.post(
      this.endpoint,
      anonymisePayload(studentId, summary),
      { Authorization: `Bearer ${token}` }
    )
    return true
  }
}

export function anonymisePayload(studentId: string, summary: SessionSummary): unknown {
  return {
    studentId,
    sessionId: summary.sessionId,
    totalTurns: summary.totalTurns,
    hintsUsed: summary.hintsUsed,
    conceptsProgressed: summary.conceptsProgressed,
    masteryDeltas: summary.masteryDeltas,
    startTime: summary.startTime.toISOString(),
    endTime: summary.endTime.toISOString(),
  }
}
