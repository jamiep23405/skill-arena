import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, Trophy, Skull, Zap, Cookie, Target, Timer, Crown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface TutorialSection {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const TutorialModal = () => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const sections: TutorialSection[] = [
    {
      icon: <Target className="w-6 h-6 text-primary" />,
      title: 'Objective',
      description: 'Be the last snake alive or have the longest snake when time runs out to win the Victory Crown!',
    },
    {
      icon: <Trophy className="w-6 h-6 text-yellow-400" />,
      title: 'How to Win',
      description: 'If you\'re the last survivor of 30 players, you win! If the timer ends with multiple players alive, the longest snake wins.',
    },
    {
      icon: isMobile ? <Zap className="w-6 h-6 text-secondary" /> : <Zap className="w-6 h-6 text-secondary" />,
      title: 'Controls',
      description: isMobile 
        ? 'Use the joystick on the left to move your snake. Tap the boost button on the right to speed up.'
        : 'Move with WASD keys or mouse. Hold Spacebar to boost and move faster.',
    },
    {
      icon: <Cookie className="w-6 h-6 text-accent" />,
      title: 'Eating Food',
      description: 'Collect glowing orbs to grow longer. Bigger orbs give more points. The longer you are, the more powerful!',
    },
    {
      icon: <Zap className="w-6 h-6 text-primary" />,
      title: 'Boost',
      description: 'Boosting makes you faster but drains your boost energy. Energy recharges when not boosting.',
    },
    {
      icon: <Skull className="w-6 h-6 text-destructive" />,
      title: 'Death',
      description: 'You die if your head hits another snake\'s body, the map border, or yourself. Cut off other players to eliminate them!',
    },
    {
      icon: <Crown className="w-6 h-6 text-yellow-400" />,
      title: 'Kills & Loot',
      description: 'When you eliminate a player, collect their dropped food to grow even larger!',
    },
    {
      icon: <Timer className="w-6 h-6 text-muted-foreground" />,
      title: 'Match Duration',
      description: 'Each match lasts 3 minutes. Survive and grow to claim victory!',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="absolute top-4 right-4 z-20 bg-card/50 border-border/50 hover:border-primary hover:bg-primary/10"
        >
          <HelpCircle className="w-5 h-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary neon-text-cyan text-center">
            HOW TO PLAY
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {sections.map((section, index) => (
            <div 
              key={index}
              className="flex gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-shrink-0 mt-1">
                {section.icon}
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground mb-1">
                  {section.title}
                </h3>
                <p className="text-sm text-muted-foreground font-body">
                  {section.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={() => setOpen(false)}
          className="w-full mt-4 font-display bg-primary text-primary-foreground hover:bg-primary/90"
        >
          GOT IT!
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default TutorialModal;
