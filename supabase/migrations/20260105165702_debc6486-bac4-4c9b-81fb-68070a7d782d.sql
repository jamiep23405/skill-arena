-- Create lobbies table for waiting rooms
CREATE TABLE public.lobbies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'starting', 'in_progress', 'completed')),
  min_players INTEGER NOT NULL DEFAULT 10,
  max_players INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  match_id UUID
);

-- Create lobby_players table
CREATE TABLE public.lobby_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL DEFAULT 'Player',
  snake_color TEXT NOT NULL DEFAULT '#00ffff',
  is_bot BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lobby_id, player_id)
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID REFERENCES public.lobbies(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  duration_seconds INTEGER NOT NULL DEFAULT 180,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  winner_id TEXT,
  map_theme TEXT NOT NULL DEFAULT 'default'
);

-- Create match_players table for final scores
CREATE TABLE public.match_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  snake_color TEXT NOT NULL,
  final_score INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  placement INTEGER,
  UNIQUE(match_id, player_id)
);

-- Add foreign key from lobbies to matches
ALTER TABLE public.lobbies ADD CONSTRAINT fk_lobbies_match FOREIGN KEY (match_id) REFERENCES public.matches(id);

-- Enable RLS on all tables
ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;

-- Public read access for lobbies (anyone can see available lobbies)
CREATE POLICY "Anyone can view lobbies" ON public.lobbies FOR SELECT USING (true);
CREATE POLICY "Anyone can create lobbies" ON public.lobbies FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update lobbies" ON public.lobbies FOR UPDATE USING (true);

-- Public access for lobby_players (game server manages this)
CREATE POLICY "Anyone can view lobby players" ON public.lobby_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join lobbies" ON public.lobby_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can leave lobbies" ON public.lobby_players FOR DELETE USING (true);

-- Public read access for matches
CREATE POLICY "Anyone can view matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Server can create matches" ON public.matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Server can update matches" ON public.matches FOR UPDATE USING (true);

-- Public read access for match_players
CREATE POLICY "Anyone can view match players" ON public.match_players FOR SELECT USING (true);
CREATE POLICY "Server can manage match players" ON public.match_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Server can update match players" ON public.match_players FOR UPDATE USING (true);

-- Enable realtime for lobby_players (to see players joining)
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies;