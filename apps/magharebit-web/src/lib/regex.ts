/** Escape user text before it goes into a MongoDB $regex, so search input is never a pattern. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
