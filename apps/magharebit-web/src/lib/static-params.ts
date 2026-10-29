/**
 * Wrap every generateStaticParams() result with this.
 *
 * `next build` (NODE_ENV=production): returns the list unchanged, so pages are prerendered as before.
 * `next dev`: returns [] and pages render on request. Reason: for each route with static params, Next 15's dev
 * server reads .next/prerender-manifest.json, adds the route and writes the file back, with no locking. When two
 * routes compile at the same time the writes interleave, the file ends up with trailing bytes, and from then on
 * every request fails with "SyntaxError: Unexpected end of JSON input" / "Unexpected non-whitespace character
 * after JSON" (next-dev-server.js, JSON.parse of that manifest) until .next is deleted. With an empty list in dev
 * that code path is never taken.
 */
export function staticParams<T>(params: T[]): T[] {
  return process.env.NODE_ENV === 'development' ? [] : params
}
