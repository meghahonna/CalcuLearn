import * as crypto from 'node:crypto'
import * as fs from 'node:fs'

export class ModelTamperingError extends Error {}

export async function verifyModelHash(filePath: string, expectedHash: string): Promise<void> {
  const actual = await sha256File(filePath)
  if (actual !== expectedHash) {
    throw new ModelTamperingError(
      `Model hash mismatch for ${filePath}: expected ${expectedHash}, got ${actual}`
    )
  }
}

export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}
