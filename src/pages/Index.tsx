import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateId, getRandomColor } from '@/lib/gameUtils';
import SnakeAnimation from '@/components/game/SnakeAnimation';
import TutorialModal from '@/components/game/TutorialModal';
import { useIsMobile } from '@/hooks/use-mobile';
import skillArenaLogo from '@/assets/skillarena-logo.png';

const Index = () => {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const isMobile = useIsMobile();

  const handlePlay = async () => {
    if (isJoining) return;
    setIsJoining(true);

    const playerId = generateId();
    const name = playerName.trim() || `Player${Math.floor(Math.random() * 1000)}`;
    const color = getRandomColor();

    // Store player info in sessionStorage for the game
    sessionStorage.setItem('playerId', playerId);
    sessionStorage.setItem('playerName', name);
    sessionStorage.setItem('playerColor', color);

    // Navigate to lobby
    navigate('/lobby');
  };

  const getControlsText = () => {
    if (isMobile) {
      return 'Use the joystick to move • Tap boost button to speed up • Collect orbs to grow';
    }
    return 'Move with WASD or mouse • Hold Space to boost • Collect orbs to grow • Don\'t hit other snakes!';
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Tutorial button */}
      <TutorialModal />

      {/* Animated background */}
      <div className="absolute inset-0 gradient-animate opacity-50" />

      {/* Snake animations in background */}
      <SnakeAnimation />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
        {/* Logo */}
        <div className={`text-center ${isMobile ? 'mb-4 mt-8' : 'mb-6 mt-16'}`}>
          <img 
            src={skillArenaLogo} 
            alt="SkillArena Logo"
            className={`mx-auto drop-shadow-[0_0_20px_hsl(var(--neon-cyan)/0.5)] ${isMobile ? 'w-56' : 'w-80 md:w-[400px] lg:w-[480px]'}`}
          />
          <p className={`font-body text-muted-foreground ${isMobile ? 'text-base mt-2' : 'text-xl md:text-2xl mt-4'}`}>
            Grow. Hunt. Dominate.
          </p>
        </div>

        {/* Play form */}
        <div className={`w-full space-y-4 ${isMobile ? 'max-w-xs' : 'max-w-md space-y-6'}`}>
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Enter your name..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              className={`font-body bg-card/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 neon-border ${isMobile ? 'h-12 text-base' : 'h-14 text-lg'}`}
            />
          </div>

          <Button
            onClick={handlePlay}
            disabled={isJoining}
            className={`w-full font-display font-bold bg-primary text-primary-foreground hover:bg-primary/90 neon-glow-cyan pulse-glow transition-all duration-300 ${isMobile ? 'h-12 text-xl' : 'h-16 text-2xl'}`}
          >
            {isJoining ? 'JOINING...' : 'PLAY'}
          </Button>
        </div>

        {/* Game info */}
        <div className={`grid grid-cols-3 text-center ${isMobile ? 'mt-8 gap-4 max-w-xs' : 'mt-16 gap-8 max-w-lg'}`}>
          <div className="space-y-1">
            <div className={`font-display font-bold text-secondary neon-text-magenta ${isMobile ? 'text-xl' : 'text-3xl'}`}>3:00</div>
            <div className={`text-muted-foreground font-body ${isMobile ? 'text-xs' : 'text-sm'}`}>Match Duration</div>
          </div>
          <div className="space-y-1">
            <div className={`font-display font-bold text-accent neon-glow-lime ${isMobile ? 'text-xl' : 'text-3xl'}`} style={{ textShadow: '0 0 10px hsl(var(--neon-lime))' }}>30</div>
            <div className={`text-muted-foreground font-body ${isMobile ? 'text-xs' : 'text-sm'}`}>Players</div>
          </div>
          <div className="space-y-1">
            <div className={`font-display font-bold text-primary neon-text-cyan ${isMobile ? 'text-xl' : 'text-3xl'}`}>∞</div>
            <div className={`text-muted-foreground font-body ${isMobile ? 'text-xs' : 'text-sm'}`}>Growth</div>
          </div>
        </div>

        {/* Instructions - device-adaptive */}
        <div className={`text-center text-muted-foreground font-body ${isMobile ? 'mt-6 max-w-xs' : 'mt-12 max-w-md'}`}>
          <p className={isMobile ? 'text-xs' : 'text-sm'}>
            {getControlsText()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
