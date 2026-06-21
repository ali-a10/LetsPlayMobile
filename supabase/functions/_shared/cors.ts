export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Builds a JSON Response with CORS headers and the given status code. */
export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Builds a non-2xx JSON error Response carrying a stable { code, message } the client maps to friendly copy. */
export function fail(code: string, message: string, status = 400): Response {
  return json({ code, message }, status);
}
