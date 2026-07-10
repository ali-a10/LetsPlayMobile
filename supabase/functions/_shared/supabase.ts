import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Creates a Supabase client using the service-role key (bypasses RLS) for server-side use inside Edge Functions. */
export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Verifies the caller's bearer JWT and returns the authenticated user, or null if missing/invalid. */
export async function getUserFromRequest(req: Request, admin: SupabaseClient) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return null;
  return user;
}
