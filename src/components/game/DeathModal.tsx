import { Eye, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeathModalProps {
  score: number;
  kills: number;
  onSpectate: () => void;
  onReturnToLobby: () => void;
}

const DeathModal = ({ score, kills, onSpectate, onReturnToLobby }: DeathModalProps) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-card border border-destructive/50 rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-glow-magenta">
        {/* Death Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/20 border-2 border-destructive flex items-center justify-center">
          <span className="text-4xl">💀</span>
        </div>

        <h2 className="text-3xl font-display font-bold text-destructive mb-2">
          You Died!
        </h2>

        {/* Stats */}
        <div className="flex justify-center gap-8 my-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-neon-cyan">{Math.floor(score)}</p>
            <p className="text-sm text-muted-foreground">Score</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-neon-magenta">{kills}</p>
            <p className="text-sm text-muted-foreground">Kills</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 mt-6">
          <Button
            onClick={onSpectate}
            variant="outline"
            className="w-full py-6 text-lg border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10"
          >
            <Eye className="w-5 h-5 mr-2" />
            Spectate
          </Button>
          <Button
            onClick={onReturnToLobby}
            className="w-full py-6 text-lg bg-primary hover:bg-primary/80"
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Lobby
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeathModal;
