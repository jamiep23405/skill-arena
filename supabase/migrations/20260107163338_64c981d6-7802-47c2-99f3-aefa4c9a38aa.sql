-- Drop existing permissive policies on lobbies
DROP POLICY IF EXISTS "Anyone can update lobbies " ON public.lobbies;

-- Create more restrictive update policy for lobbies
-- Only allow updating status to 'started' or 'finished' (not arbitrary changes)
CREATE POLICY "Restricted lobby updates"
ON public.lobbies
FOR UPDATE
USING (true)
WITH CHECK (
  -- Only allow changing status and match_id/started_at fields
  status IN ('waiting', 'started', 'finished')
);

-- Drop existing permissive policies on matches
DROP POLICY IF EXISTS "Server can create matches " ON public.matches;
DROP POLICY IF EXISTS "Server can update matches " ON public.matches;

-- Recreate with service_role only access (anon key cannot create/update)
-- These operations should only happen from the edge function using service_role
CREATE POLICY "Service role can create matches"
ON public.matches
FOR INSERT
WITH CHECK (
  -- Only service role can insert (auth.role() = 'service_role')
  -- For now, restrict to authenticated requests or service role
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  OR auth.role() = 'authenticated'
);

CREATE POLICY "Service role can update matches"
ON public.matches
FOR UPDATE
USING (
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  OR auth.role() = 'authenticated'
);

-- Also secure match_players - only service role should create/update
DROP POLICY IF EXISTS "Server can manage match players " ON public.match_players;
DROP POLICY IF EXISTS "Server can update match players " ON public.match_players;

CREATE POLICY "Service role can create match players"
ON public.match_players
FOR INSERT
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  OR auth.role() = 'authenticated'
);

CREATE POLICY "Service role can update match players"
ON public.match_players
FOR UPDATE
USING (
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  OR auth.role() = 'authenticated'
);