import { useRef, useCallback, useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface MobileControlsProps {
  onDirectionChange: (dx: number, dy: number) => void;
  onBoostChange: (isBoosting: boolean) => void;
  isMobile: boolean;
}

const MobileControls = ({ onDirectionChange, onBoostChange, isMobile }: MobileControlsProps) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);
  const touchIdRef = useRef<number | null>(null);
  const centerRef = useRef({ x: 0, y: 0 });

  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!joystickRef.current) return;
    
    touchIdRef.current = touch.identifier;
    const rect = joystickRef.current.getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setIsJoystickActive(true);
  }, []);

  const handleJoystickMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (touchIdRef.current === null) return;

    const touch = Array.from(e.touches).find(t => t.identifier === touchIdRef.current);
    if (!touch || !joystickRef.current || !knobRef.current) return;

    const rect = joystickRef.current.getBoundingClientRect();
    const maxRadius = rect.width / 2 - 25;

    let dx = touch.clientX - centerRef.current.x;
    let dy = touch.clientY - centerRef.current.y;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;

    // Normalize direction
    const normalizedDx = dx / maxRadius;
    const normalizedDy = dy / maxRadius;
    onDirectionChange(normalizedDx, normalizedDy);
  }, [onDirectionChange]);

  const handleJoystickEnd = useCallback((e: TouchEvent) => {
    const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
    if (!touch) return;

    touchIdRef.current = null;
    setIsJoystickActive(false);
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)';
    }
    onDirectionChange(0, 0);
  }, [onDirectionChange]);

  useEffect(() => {
    if (!isMobile) return;

    window.addEventListener('touchmove', handleJoystickMove, { passive: false });
    window.addEventListener('touchend', handleJoystickEnd);
    window.addEventListener('touchcancel', handleJoystickEnd);

    return () => {
      window.removeEventListener('touchmove', handleJoystickMove);
      window.removeEventListener('touchend', handleJoystickEnd);
      window.removeEventListener('touchcancel', handleJoystickEnd);
    };
  }, [isMobile, handleJoystickMove, handleJoystickEnd]);

  const handleBoostStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsBoosting(true);
    onBoostChange(true);
  }, [onBoostChange]);

  const handleBoostEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsBoosting(false);
    onBoostChange(false);
  }, [onBoostChange]);

  if (!isMobile) return null;

  return (
    <>
      {/* Joystick - Left side */}
      <div
        ref={joystickRef}
        className="fixed bottom-8 left-8 w-32 h-32 rounded-full bg-black/50 border-2 border-neon-cyan/50 flex items-center justify-center z-50 touch-none"
        onTouchStart={handleJoystickStart}
      >
        <div
          ref={knobRef}
          className={`w-16 h-16 rounded-full transition-colors ${
            isJoystickActive 
              ? 'bg-neon-cyan shadow-glow-cyan' 
              : 'bg-neon-cyan/50'
          }`}
          style={{ transition: 'background-color 0.1s, box-shadow 0.1s' }}
        />
      </div>

      {/* Boost Button - Right side */}
      <button
        className={`fixed bottom-8 right-8 w-24 h-24 rounded-full flex items-center justify-center z-50 touch-none transition-all ${
          isBoosting
            ? 'bg-neon-magenta shadow-glow-magenta scale-110'
            : 'bg-neon-magenta/50 border-2 border-neon-magenta/70'
        }`}
        onTouchStart={handleBoostStart}
        onTouchEnd={handleBoostEnd}
        onTouchCancel={handleBoostEnd}
      >
        <Zap className="w-10 h-10 text-white" fill={isBoosting ? 'white' : 'none'} />
      </button>
    </>
  );
};

export default MobileControls;
