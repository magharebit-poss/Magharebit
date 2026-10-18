// Runs once per server process (Node runtime only).
// Used to apply infrastructure-level config that must be set before any
// request handling begins.
//
// Current responsibilities:
//   1. Set public DNS servers so that MongoDB Atlas SRV lookups succeed even
//      when the local network resolver refuses SRV queries (router DNS
//      192.168.1.254). On Vercel this is effectively a no-op.
//   2. (Local dev) Downgrade TLS default max version to TLSv1.2 as a
//      compatibility shim for OpenSSL 3.5.x where Atlas TLS negotiation
//      may fail with newer post-quantum extensions.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // ── 1. DNS ────────────────────────────────────────────────────────────────
    const dns = await import('node:dns')
    // Multiple resolvers for redundancy; Node tries them in order.
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1'])
    console.log('[instrumentation] DNS resolvers → 8.8.8.8 / 1.1.1.1')

    // ── 2. TLS compatibility shim (OpenSSL 3.5.x / Node 24) ──────────────────
    // OpenSSL 3.5.6 ships with Node.js 24 and includes post-quantum TLS 1.3
    // extensions (ML-KEM / Kyber key shares) that some TLS terminators may not
    // support, causing an immediate "internal_error (80)" alert during handshake.
    // Setting DEFAULT_MAX_VERSION to TLSv1.2 avoids TLS 1.3 negotiation until
    // the remote end confirms TLS 1.3 compatibility.  No-op on older OpenSSL.
    //
    // IMPORTANT: if your Atlas cluster is paused (free-tier auto-pause after
    // 60 days of inactivity), the same TLS error appears regardless of TLS
    // version.  Resume the cluster from the MongoDB Atlas console first, then
    // restart the dev server.
    try {
      const tls = await import('tls')
      if (tls.DEFAULT_MAX_VERSION === 'TLSv1.3') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(tls as any).DEFAULT_MAX_VERSION = 'TLSv1.2'
        console.log('[instrumentation] TLS max version capped at TLSv1.2 (OpenSSL 3.5.x shim)')
      }
    } catch {
      // Non-critical — proceed without the shim if it fails
    }
  }
}
