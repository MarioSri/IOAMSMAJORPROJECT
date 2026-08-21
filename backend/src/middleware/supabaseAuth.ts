/**
 * Backward-compatible exports for older imports.
 *
 * Authentication is implemented in one place so token validation and role
 * semantics cannot drift between routes.
 */
export {
  authenticateToken as supabaseAuth,
  authenticateToken as verifySupabaseToken,
  requireRole,
} from './auth';
