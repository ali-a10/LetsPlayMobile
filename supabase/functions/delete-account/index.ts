import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Deletes all data associated with the authenticated user, then removes their auth account. */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = authHeader.replace('Bearer ', '');

    // Create an admin client using the service role key (auto-available in Edge Functions)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the JWT and get the user — this ensures the caller is who they say they are
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Step 1: Delete this user's participation records in other people's events
    const { error: participantError } = await adminClient
      .from('participants')
      .delete()
      .eq('user_id', userId);
    if (participantError) throw new Error(`Failed to delete participant records: ${participantError.message}`);

    // Step 2: Get IDs of events this user hosts, then delete their participants
    const { data: hostedEvents, error: hostedError } = await adminClient
      .from('events')
      .select('id')
      .eq('host_id', userId);
    if (hostedError) throw new Error(`Failed to fetch hosted events: ${hostedError.message}`);

    if (hostedEvents && hostedEvents.length > 0) {
      const hostedEventIds = hostedEvents.map((e: { id: string }) => e.id);

      const { error: hostedParticipantsError } = await adminClient
        .from('participants')
        .delete()
        .in('event_id', hostedEventIds);
      if (hostedParticipantsError) throw new Error(`Failed to delete hosted event participants: ${hostedParticipantsError.message}`);

      // Step 3: Delete the hosted events themselves
      const { error: eventsError } = await adminClient
        .from('events')
        .delete()
        .eq('host_id', userId);
      if (eventsError) throw new Error(`Failed to delete hosted events: ${eventsError.message}`);
    }

    // Step 4: Delete avatar from storage if the user has one
    const { data: profile } = await adminClient
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (profile?.avatar_url) {
      // Extract the file path from the URL — format is: .../storage/v1/object/public/<bucket>/<path>
      const url = new URL(profile.avatar_url);
      const pathParts = url.pathname.split('/storage/v1/object/public/avatars/');
      if (pathParts.length === 2) {
        await adminClient.storage.from('avatars').remove([pathParts[1]]);
        // Non-fatal: if the file is already gone, we continue
      }
    }

    // Step 5: Delete the profile row
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (profileError) throw new Error(`Failed to delete profile: ${profileError.message}`);

    // Step 6: Delete the Supabase Auth user — requires service role key
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) throw new Error(`Failed to delete auth user: ${deleteUserError.message}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
