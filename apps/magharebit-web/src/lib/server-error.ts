import { NextResponse } from 'next/server'

/**
 * Generic 500 for API handlers. The client gets only a stable error code; the detail goes to the server log.
 *
 * Handlers used to return the raw exception text as `detail`. A MongoDB duplicate-key or validation error carries
 * the database and index names and the offending VALUE (often a customer's phone number), so it was an information
 * leak to the browser. The log line keeps the cause but masks long digit runs (phones, ids) and e-mail addresses
 * (Law 09-08: no raw personal data in logs).
 */
export function maskPii(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/\d{6,}/g, (d) => `<${d.length} digits>`)
    .slice(0, 500)
}

export function internalError(scope: string, err: unknown, code: string): NextResponse {
  const name = err instanceof Error ? err.name : typeof err
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[${scope}] ${code}: ${name}: ${maskPii(message)}`)
  return NextResponse.json({ error: code }, { status: 500 })
}
