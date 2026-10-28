/**
 * Calendar days in a named time zone (default Africa/Casablanca), without a date library.
 *
 * Morocco is UTC+1 most of the year and UTC+0 during Ramadan, so "today" can never be computed with a fixed
 * offset. These helpers ask Intl (the tz database bundled with Node and every browser) for the offset at a
 * given instant instead. Pure functions, safe on the server and in the browser.
 */

export const MOROCCO_TZ = 'Africa/Casablanca'

const partsFormatters = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    partsFormatters.set(tz, f)
  }
  return f
}

/** Offset of `tz` from UTC at instant `at`, in milliseconds (Casablanca: +3 600 000, or 0 during Ramadan). */
export function tzOffsetMs(at: Date, tz: string = MOROCCO_TZ): number {
  const p: Record<string, string> = {}
  for (const x of partsFormatter(tz).formatToParts(at)) p[x.type] = x.value
  const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return wallAsUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** "YYYY-MM-DD" of instant `at` on the wall calendar of `tz`. */
export function zonedDateKey(at: Date, tz: string = MOROCCO_TZ): string {
  const local = new Date(at.getTime() + tzOffsetMs(at, tz))
  return local.toISOString().slice(0, 10)
}

/**
 * The instant of local midnight that starts the day containing `at`, shifted by `dayOffset` days
 * (0 = today, -1 = yesterday). Correct across offset changes because the offset is looked up at midnight itself.
 */
export function zonedDayStart(at: Date, tz: string = MOROCCO_TZ, dayOffset = 0): Date {
  const local = new Date(at.getTime() + tzOffsetMs(at, tz))
  const midnightAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset)
  let t = midnightAsUtc - tzOffsetMs(new Date(midnightAsUtc), tz)
  t = midnightAsUtc - tzOffsetMs(new Date(t), tz) // second pass settles a change of offset on that very day
  return new Date(t)
}

/** Local midnight that starts the calendar day "YYYY-MM-DD" in `tz`, or null for a malformed key. */
export function zonedStartOfKey(key: string, tz: string = MOROCCO_TZ): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const noonUtc = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12))
  if (Number.isNaN(noonUtc.getTime()) || noonUtc.toISOString().slice(0, 10) !== key) return null
  return zonedDayStart(noonUtc, tz)
}
