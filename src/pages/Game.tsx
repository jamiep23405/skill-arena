import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GameCanvas from '@/components/game/GameCanvas';
import GameHUD from '@/components/game/GameHUD';
import DeathModal from '@/components/game/DeathModal';
import { useGameState } from '@/hooks/useGameState';
import { generateId } from '@/lib/gameUtils';

const Game = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [isSpectating, setIsSpectating] = useState(false);
  const [spectateTargetId, setSpectateTargetId] = useState<string | null>(null);
  const [deathStats, setDeathStats] = useState({ score: 0, kills: 0 });

  const playerId = sessionStorage.getItem('playerId') || generateId();
  const playerName = sessionStorage.getItem('playerName') || 'Player';
  const playerColor = sessionStorage.getItem('playerColor') || '#00ffff';

  const { 
    gameState, 
    updateGameState, 
    handlePlayerInput,
    getBoostEnergy,
  } = useGameState(playerId);

  const connectToServer = useCallback(() => {
    if (!matchId) return;

    // Local game simulation (no server needed)
    setIsConnected(true);
    
    // Initialize local game state
    updateGameState({
      matchId,
      status: 'playing',
      timeRemaining: 180,
      snakes: [],
      food: [],
    });
  }, [matchId, updateGameState]);

  useEffect(() => {
    connectToServer();
  }, [connectToServer]);

  // Check if player died
  useEffect(() => {
    const playerSnake = gameState.snakes.find(s => s.id === playerId);
    
    if (playerSnake && !playerSnake.isAlive && !isDead) {
      setIsDead(true);
      setDeathStats({
        score: playerSnake.score,
        kills: playerSnake.kills,
      });
    }
  }, [gameState.snakes, playerId, isDead]);

  // Save results locally and navigate to results when game ends
  useEffect(() => {
    if (gameState.status !== 'ended' || !matchId) return;

    // Sort snakes by score (highest first) to determine winner and placements
    const sortedSnakes = [...gameState.snakes]
      .sort((a, b) => b.score - a.score);

    // Save results to sessionStorage
    const results = sortedSnakes.map((s, index) => ({
      player_id: s.id,
      player_name: s.name,
      snake_color: s.color,
      final_score: s.score,
      kills: s.kills,
      placement: index + 1,
      is_bot: s.id.startsWith('bot_'),
    }));
    
    sessionStorage.setItem('gameResults', JSON.stringify(results));

    // Navigate to results
    navigate(`/results/${matchId}`);
  }, [gameState.status, gameState.snakes, matchId, navigate]);

  const handleSpectate = () => {
    setIsSpectating(true);
    // Find a random alive snake to spectate
    const aliveSnake = gameState.snakes.find(s => s.isAlive && s.id !== playerId);
    if (aliveSnake) {
      setSpectateTargetId(aliveSnake.id);
    }
  };

  const handleExitSpectate = () => {
    navigate('/');
  };

  const handleReturnToLobby = () => {
    navigate('/');
  };

  const currentPlayer = gameState.snakes.find(s => s.id === playerId);

  return (
    <div className="w-screen h-screen overflow-hidden bg-game-bg">
      <GameCanvas
        gameState={gameState}
        playerId={playerId}
        playerName={playerName}
        playerColor={playerColor}
        onInput={handlePlayerInput}
        isLocalGame={true}
        isSpectating={isSpectating}
        spectateTargetId={spectateTargetId}
      />
      <GameHUD
        score={currentPlayer?.score || 0}
        timeRemaining={gameState.timeRemaining}
        isConnected={isConnected}
        playerCount={gameState.snakes.filter(s => s.isAlive).length}
        playerId={playerId}
        players={gameState.snakes.map(s => ({
          id: s.id,
          name: s.name,
          score: s.score,
          isAlive: s.isAlive,
          color: s.color,
        }))}
        isBoosting={currentPlayer?.isBoosting || false}
        boostEnergy={getBoostEnergy(playerId)}
      />
      
      {/* Exit button while alive */}
      {!isDead && !isSpectating && (
        <Button
          onClick={handleReturnToLobby}
          variant="ghost"
          size="icon"
          className="absolute top-4 right-20 z-50 bg-card/80 backdrop-blur-sm hover:bg-destructive/20 border border-border"
        >
          <LogOut className="w-5 h-5 text-muted-foreground" />
        </Button>
      )}
      
      {/* Spectator mode exit button */}
      {isSpectating && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50">
          <Button
            onClick={handleExitSpectate}
            variant="outline"
            className="bg-card/90 backdrop-blur-sm border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10"
          >
            <X className="w-4 h-4 mr-2" />
            Exit Spectator Mode
          </Button>
        </div>
      )}
      
      {/* Death Modal */}
      {isDead && !isSpectating && (
        <DeathModal
          score={deathStats.score}
          kills={deathStats.kills}
          onSpectate={handleSpectate}
          onReturnToLobby={handleReturnToLobby}
        />
      )}
    </div>
  );
};

export default Game;