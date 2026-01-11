import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GAME_CONFIG, SNAKE_COLORS } from '@/lib/gameTypes';
import { generateId } from '@/lib/gameUtils';

interface LobbyPlayer {
  id: string;
  player_id: string;
  player_name: string;
  snake_color: string;
  is_bot: boolean;
}

// Random name generator for bots
const BOT_NAME_PREFIXES = [
  'Swift', 'Dark', 'Silent', 'Toxic', 'Neon', 'Cyber', 'Shadow', 'Venom', 'Plasma', 'Storm',
  'Blaze', 'Frost', 'Thunder', 'Stealth', 'Chaos', 'Mystic', 'Crimson', 'Golden', 'Iron', 'Crystal',
  'Rapid', 'Deadly', 'Fierce', 'Wild', 'Primal', 'Ancient', 'Cosmic', 'Electric', 'Phantom', 'Ghost'
];

const BOT_NAME_SUFFIXES = [
  'Slither', 'Viper', 'Python', 'Cobra', 'Mamba', 'Fang', 'Strike', 'Coil', 'Scale', 'Serpent',
  'Hunter', 'Stalker', 'Crawler', 'Glider', 'Striker', 'Devourer', 'Predator', 'Reaper', 'Slayer', 'Beast',
  'King', 'Lord', 'Master', 'Titan', 'Giant', 'Monster', 'Demon', 'Spirit', 'Dragon', 'Wyrm'
];

const generateBotName = (): string => {
  const prefix = BOT_NAME_PREFIXES[Math.floor(Math.random() * BOT_NAME_PREFIXES.length)];
  const suffix = BOT_NAME_SUFFIXES[Math.floor(Math.random() * BOT_NAME_SUFFIXES.length)];
  const number = Math.floor(Math.random() * 99) + 1;
  return `${prefix}${suffix}${number}`;
};

const generateBots = (count: number, usedColors: Set<string>): LobbyPlayer[] => {
  const availableColors = SNAKE_COLORS.filter(c => !usedColors.has(c));
  const bots: LobbyPlayer[] = [];
  
  for (let i = 0; i < count; i++) {
    const botId = `bot_${generateId()}`;
    bots.push({
      id: botId,
      player_id: botId,
      player_name: generateBotName(),
      snake_color: availableColors[i % availableColors.length] || 
        `hsl(${Math.random() * 360}, 100%, 50%)`,
      is_bot: true,
    });
  }
  
  return bots;
};

const Lobby = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const countdownStartedRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const playerId = sessionStorage.getItem('playerId') || generateId();
  const playerName = sessionStorage.getItem('playerName') || 'Player';
  const playerColor = sessionStorage.getItem('playerColor') || '#00ffff';

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Store player info if not already stored
    if (!sessionStorage.getItem('playerId')) {
      sessionStorage.setItem('playerId', playerId);
      sessionStorage.setItem('playerName', playerName);
      sessionStorage.setItem('playerColor', playerColor);
    }

    // Add the current player to the list
    const currentPlayer: LobbyPlayer = {
      id: playerId,
      player_id: playerId,
      player_name: playerName,
      snake_color: playerColor,
      is_bot: false,
    };
    setPlayers([currentPlayer]);
  }, [playerId, playerName, playerColor]);

  useEffect(() => {
    // Start countdown immediately when player is added
    if (players.length > 0 && !countdownStartedRef.current && countdown === null && !isStarting) {
      countdownStartedRef.current = true;
      setCountdown(GAME_CONFIG.LOBBY_WAIT_TIME);
    }
  }, [players.length, countdown, isStarting]);

  useEffect(() => {
    if (countdown === null || countdown <= 0 || isStarting) return;

    const timer = setTimeout(() => {
      if (countdown === 1) {
        startGameLocally();
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isStarting]);

  const startGameLocally = () => {
    if (isStarting) return;
    setIsStarting(true);

    // Get current real players
    const realPlayers = players.filter(p => !p.is_bot);
    const botsNeeded = GAME_CONFIG.TOTAL_PLAYERS - realPlayers.length;

    // Generate bots to fill remaining slots
    const usedColors = new Set(realPlayers.map(p => p.snake_color));
    const bots = generateBots(botsNeeded, usedColors);

    // Combine all players
    const allPlayers = [...realPlayers, ...bots];
    setPlayers(allPlayers);

    // Store players in sessionStorage for the game
    sessionStorage.setItem('gamePlayers', JSON.stringify(allPlayers));

    // Generate a local match ID and navigate to game
    const matchId = generateId();
    navigate(`/game/${matchId}`);
  };

  const handleLeave = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 gradient-animate opacity-30" />
      
      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--neon-cyan) / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--neon-cyan) / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-primary neon-text-cyan mb-8">
          WAITING FOR PLAYERS
        </h1>

        {/* Player count */}
        <div className="mb-8 text-center">
          <div className="text-6xl font-display font-bold text-foreground mb-2">
            <span className="text-accent">
              {players.filter(p => !p.is_bot).length}
            </span>
            <span className="text-muted-foreground"> / {GAME_CONFIG.TOTAL_PLAYERS}</span>
          </div>
          <p className="text-muted-foreground font-body text-lg">
            {isStarting 
              ? 'Starting game...'
              : `${GAME_CONFIG.TOTAL_PLAYERS - players.filter(p => !p.is_bot).length} slots will be filled with bots`}
          </p>
        </div>

        {/* Countdown */}
        {countdown !== null && !isStarting && (
          <div className="mb-8">
            <div className="text-8xl font-display font-bold text-accent neon-glow-lime animate-pulse">
              {countdown}
            </div>
            <p className="text-center text-muted-foreground font-body">
              Waiting for players... Game starts soon!
            </p>
          </div>
        )}

        {/* Player list */}
        <div className="w-full max-w-md bg-card/50 rounded-lg p-4 neon-border mb-8">
          <h2 className="font-display text-lg font-semibold text-foreground mb-4">Players</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 p-2 rounded bg-muted/30"
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ 
                    backgroundColor: player.snake_color,
                    boxShadow: `0 0 10px ${player.snake_color}`,
                  }}
                />
                <span className="font-body text-foreground">
                  {player.player_name}
                  {player.player_id === playerId && (
                    <span className="text-primary ml-2">(You)</span>
                  )}
                  {player.is_bot && (
                    <span className="text-muted-foreground ml-2">[BOT]</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handleLeave}
            disabled={isStarting}
            className="font-display border-border/50 text-muted-foreground hover:text-foreground hover:border-primary"
          >
            Leave
          </Button>
        </div>

        {/* Loading indicator */}
        <div className="mt-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;