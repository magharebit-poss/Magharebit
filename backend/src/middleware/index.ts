import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    registerId: string;
    role?: string;
    auth?: AuthClaims;
  }
  // Per-route config flags consumed by the auth hook below.
  interface FastifyContextConfig {
    /** When true, the route is reachable without a JWT (e.g. health, token-issuing PIN endpoints). */
    public?: boolean;
    /** When set, the caller's JWT `role` must be one of these values, else 403. */
    allowedRoles?: readonly string[];
  }
}

/**
 * Claims carried in a GreenGo JWT.
 * Staff tokens (issued at POST /shifts/open) use snake_case fields.
 * Portal tokens (issued at POST /portal/auth/login) use camelCase `tenantId`.
 * NEVER contains pin, pin_hash, or any secret material.
 */
export interface AuthClaims {
  staff_id?: string;
  tenant_id?: string;
  tenantId?: string;
  registerId?: string;
  role?: string;
  shift_id?: string;
  iat?: number;
  exp?: number;
}

/**
 * Transport-layer authentication + authorization.
 *
 * Registered as a GLOBAL onRequest hook on the root instance so it applies to
 * every route in every currently-registered module (admin, pos, portal, health).
 *
 * Secure by default: a route is protected unless it explicitly declares
 * `config.public === true`. Routes may also declare `config.allowedRoles`
 * to enforce a role at the middleware level.
 */
export async function authMiddleware(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const cfg = request.routeOptions?.config as
      | { public?: boolean; allowedRoles?: readonly string[] }
      | undefined;

    // ── Public routes (health, version, token-issuing PIN endpoints, portal login) ──
    if (cfg?.public === true) return;

    // ── Static asset routes — product images are public (no token needed to display them) ──
    if (request.url.startsWith('/images/')) return;

    // ── Authenticate ──────────────────────────────────────────────────────
    let claims: AuthClaims;
    try {
      // jwtVerify reads the Authorization: Bearer header, falling back to the
      // portal_token cookie (configured in index.ts).
      claims = await request.jwtVerify<AuthClaims>();
    } catch {
      // Do NOT log token contents — only request metadata.
      request.log.warn(
        { method: request.method, url: request.url, ip: request.ip },
        'auth: missing or invalid JWT',
      );
      return reply.status(401).send({ error: 'Invalid or missing authentication token' });
    }

    // Populate request — support both staff (snake_case) and portal (camelCase) tokens.
    request.auth = claims;
    request.tenantId = (claims.tenant_id ?? claims.tenantId) as string;
    request.registerId = claims.registerId as string;
    request.role = claims.role;

    // ── Authorize (role assertion) ────────────────────────────────────────
    const allowed = cfg?.allowedRoles;
    if (allowed && allowed.length > 0) {
      if (!claims.role || !allowed.includes(claims.role)) {
        request.log.warn(
          { method: request.method, url: request.url, ip: request.ip, role: claims.role ?? null },
          'auth: role not permitted',
        );
        return reply.status(403).send({ error: 'Forbidden: insufficient role' });
      }
    }
  });
}
