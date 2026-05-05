import { v4 as uuidv4 } from 'uuid'
import type { Database } from 'better-sqlite3'

export function createStudentProfile(db: Database, now: Date = new Date()): string {
  const id = uuidv4()
  db.prepare<[string, number]>(
    `INSERT INTO students (id, created_at) VALUES (?, ?)`
  ).run(id, now.getTime())
  return id
}
