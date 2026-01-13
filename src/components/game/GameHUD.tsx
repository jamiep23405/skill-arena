import { formatTime } from '@/lib/gameUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface GameHUDProps {
  score: number;
  timeRemaining: number;
  isConnected: boolean;
  playerCount: number;
  // For leaderboard
  playerId: string;
  players: Array<{ id: string; name: string; score: number; isAlive: boolean; color: string }>;
  isBoosting?: boolean;
  boostEnergy?: number; // 0-100 boost energy
}

const GameHUD = ({
  score,
  timeRemaining,
  isConnected,
  playerCount,
  playerId,
  players,
  isBoosting = false,
  boostEnergy = 50,
}: GameHUDProps) => {
  const isMobile = useIsMobile();
  const [showMobileLeaderboard, setShowMobileLeaderboard] = useState(false);

  const leaderboard = [...players]
    .filter(p => p.isAlive)
    .sort((a, b) => b.score - a.score);

  const myRank = Math.max(1, leaderboard.findIndex(p => p.id === playerId) + 1);
  const top = leaderboard.slice(0, 5);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top left - Score */}
      <div className={`absolute top-2 left-2 bg-card/80 backdrop-blur-sm rounded-lg neon-border ${isMobile ? 'p-2' : 'p-4'}`}>
        <div className={`text-muted-foreground font-body ${isMobile ? 'text-xs' : 'text-sm'}`}>SCORE</div>
        <div className={`font-display font-bold text-primary neon-text-cyan ${isMobile ? 'text-xl' : 'text-3xl'}`}>
          {Math.floor(score).toLocaleString()}
        </div>
      </div>

      {/* Top center - Timer */}
      <div className={`absolute top-2 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-sm rounded-lg neon-border ${isMobile ? 'px-3 py-1.5' : 'px-6 py-3'}`}>
        <div
          className={`font-display font-bold ${isMobile ? 'text-2xl' : 'text-4xl'} ${
            timeRemaining <= 30 ? 'text-destructive animate-pulse' : 'text-foreground'
          }`}
        >
          {formatTime(timeRemaining)}
        </div>
      </div>

      {/* Top right - Alive + Leaderboard */}
      <div className="absolute top-2 right-2 flex flex-col gap-2">
        {/* Alive counter with rank */}
        <div className={`bg-card/80 backdrop-blur-sm rounded-lg neon-border ${isMobile ? 'p-2' : 'p-4'}`}>
          <div className={`text-muted-foreground font-body ${isMobile ? 'text-xs' : 'text-sm'}`}>ALIVE</div>
          <div className={`font-display font-bold text-accent ${isMobile ? 'text-lg' : 'text-2xl'}`}>{playerCount}</div>
          <div className={`text-muted-foreground font-body ${isMobile ? 'text-[10px] mt-0.5' : 'text-xs mt-1'}`}>Rank: #{myRank}</div>
        </div>

        {/* Mobile: Collapsible leaderboard toggle */}
        {isMobile && (
          <button
            onClick={() => setShowMobileLeaderboard(!showMobileLeaderboard)}
            className="pointer-events-auto bg-card/80 backdrop-blur-sm rounded-lg p-2 neon-border flex items-center justify-between gap-2"
          >
            <span className="text-xs text-muted-foreground font-body">TOP 5</span>
            {showMobileLeaderboard ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        )}

        {/* Mobile: Collapsible leaderboard */}
        {isMobile && showMobileLeaderboard && (
          <div className="bg-card/90 backdrop-blur-sm rounded-lg p-2 neon-border min-w-[140px] pointer-events-auto">
            <div className="space-y-1">
              {top.map((p, idx) => {
                const isMe = p.id === playerId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between text-xs font-body ${
                      isMe ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="truncate max-w-[60px]">{p.name}</span>
                    </div>
                    <span className="tabular-nums text-[10px]">{Math.floor(p.score)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Desktop: Always visible leaderboard */}
        {!isMobile && (
          <div className="bg-card/80 backdrop-blur-sm rounded-lg p-4 neon-border min-w-[220px]">
            <div className="text-sm text-muted-foreground font-body">LEADERBOARD</div>
            <div className="mt-2 space-y-1">
              {top.map((p, idx) => {
                const isMe = p.id === playerId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between text-sm font-body ${
                      isMe ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground tabular-nums">#{idx + 1}</span>
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="truncate">{p.name}{isMe ? ' (You)' : ''}</span>
                    </div>
                    <span className="tabular-nums">{Math.floor(p.score)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom left - Connection status */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent' : 'bg-destructive'} animate-pulse`} />
        <span className="text-sm text-muted-foreground font-body">
          {isConnected ? 'Connected' : 'Reconnecting...'}
        </span>
      </div>

      {/* Bottom center - Controls hint (desktop only) */}
      {!isMobile && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-muted-foreground font-body">
          <span className="opacity-50">Move: Mouse • Boost: Hold Click</span>
        </div>
      )}
    </div>
  );
};

export default GameHUD;
