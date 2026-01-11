import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Award } from 'lucide-react';

interface MatchPlayer {
  player_id: string;
  player_name: string;
  snake_color: string;
  final_score: number;
  kills: number;
  placement: number;
  is_bot: boolean;
}

const Results = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  const playerId = sessionStorage.getItem('playerId');

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = () => {
    const stored = sessionStorage.getItem('gameResults');
    
    if (stored) {
      try {
        const results = JSON.parse(stored);
        setPlayers(results);
      } catch (err) {
        console.error('Error parsing results:', err);
        navigate('/');
        return;
      }
    } else {
      // No results found - redirect to home
      navigate('/');
      return;
    }
    
    setLoading(false);
  };

  const getPlacementIcon = (placement: number) => {
    switch (placement) {
      case 1:
        return <Trophy className="w-8 h-8 text-yellow-400" />;
      case 2:
        return <Medal className="w-7 h-7 text-gray-300" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="text-xl font-display font-bold text-muted-foreground">#{placement}</span>;
    }
  };

  const handlePlayAgain = () => {
    navigate('/lobby');
  };

  const handleHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-2xl font-display animate-pulse">
          Loading results...
        </div>
      </div>
    );
  }

  const winner = players[0];
  const isWinner = winner?.player_id === playerId;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 gradient-animate opacity-30" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
        {/* Winner announcement */}
        {winner && (
          <div className="text-center mb-8">
            <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-float" />
            <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-2">
              {isWinner ? 'YOU WON!' : 'GAME OVER'}
            </h1>
            <p className="text-xl text-muted-foreground font-body">
              {isWinner ? 'Congratulations!' : `${winner.player_name} wins!`}
            </p>
          </div>
        )}

        {/* Leaderboard */}
        <div className="w-full max-w-lg bg-card/50 rounded-lg p-6 neon-border mb-8">
          <h2 className="font-display text-2xl font-semibold text-primary neon-text-cyan mb-6 text-center">
            FINAL LEADERBOARD
          </h2>
          
          <div className="space-y-3">
            {players.map((player, index) => (
              <div
                key={player.player_id}
                className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                  player.player_id === playerId
                    ? 'bg-primary/20 neon-border'
                    : 'bg-muted/30'
                } ${index < 3 ? 'scale-100' : 'scale-95'}`}
              >
                {/* Placement */}
                <div className="w-12 flex justify-center">
                  {getPlacementIcon(index + 1)}
                </div>

                {/* Snake color indicator */}
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: player.snake_color,
                    boxShadow: `0 0 10px ${player.snake_color}`,
                  }}
                />

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="font-body font-semibold text-foreground truncate">
                    {player.player_name}
                    {player.player_id === playerId && (
                      <span className="text-primary ml-2">(You)</span>
                    )}
                    {player.is_bot && (
                      <span className="text-muted-foreground ml-2 text-sm">[BOT]</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {player.kills} kill{player.kills !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <div className={`font-display font-bold text-xl ${
                    index === 0 ? 'text-yellow-400' : 
                    index === 1 ? 'text-gray-300' : 
                    index === 2 ? 'text-amber-600' : 
                    'text-foreground'
                  }`}>
                    {player.final_score.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={handleHome}
            className="font-display px-8 border-border/50 text-muted-foreground hover:text-foreground hover:border-primary"
          >
            Home
          </Button>
          <Button
            onClick={handlePlayAgain}
            className="font-display px-8 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow-cyan"
          >
            Play Again
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Results;