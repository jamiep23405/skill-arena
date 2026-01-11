import { useEffect, useRef, useCallback, useState } from 'react';
import { SerializedGameState, GAME_CONFIG } from '@/lib/gameTypes';
import MobileControls from './MobileControls';
import { useIsMobile } from '@/hooks/use-mobile';

interface GameCanvasProps {
  gameState: SerializedGameState;
  playerId: string;
  playerName: string;
  playerColor: string;
  onInput: (targetX: number, targetY: number, isBoosting: boolean) => void;
  isLocalGame?: boolean;
  isSpectating?: boolean;
  spectateTargetId?: string | null;
}

const GameCanvas = ({
  gameState,
  playerId,
  playerName,
  playerColor,
  onInput,
  isLocalGame = false,
  isSpectating = false,
  spectateTargetId = null,
}: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const isBoostingRef = useRef(false);
  const cameraRef = useRef({ x: GAME_CONFIG.MAP_WIDTH / 2, y: GAME_CONFIG.MAP_HEIGHT / 2 });
  
  // Keep latest game state in a ref so render/input loops don't restart on every tick
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Track which keys are currently held down
  const keysHeldRef = useRef<Set<string>>(new Set());
  // For mobile joystick
  const joystickRef = useRef<{ dx: number; dy: number; active: boolean }>({ dx: 0, dy: 0, active: false });
  const isMobile = useIsMobile();

  // Handle mobile joystick direction
  const handleMobileDirection = useCallback((dx: number, dy: number) => {
    joystickRef.current = { dx, dy, active: dx !== 0 || dy !== 0 };
  }, []);

  // Handle mobile boost
  const handleMobileBoost = useCallback((boosting: boolean) => {
    isBoostingRef.current = boosting;
  }, []);

  // Handle mouse movement (desktop only)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isMobile || isSpectating) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Convert screen position to world position
    const worldX = screenX - canvas.width / 2 + cameraRef.current.x;
    const worldY = screenY - canvas.height / 2 + cameraRef.current.y;

    mouseRef.current = { x: worldX, y: worldY };
  }, [isMobile, isSpectating]);

  // Handle boost (mouse click for desktop)
  const handleMouseDown = useCallback(() => {
    if (isMobile || isSpectating) return;
    isBoostingRef.current = true;
  }, [isMobile, isSpectating]);

  const handleMouseUp = useCallback(() => {
    if (isMobile) return;
    isBoostingRef.current = false;
  }, [isMobile]);

  // Desktop WASD controls - track held keys
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isSpectating) return;
    
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
      keysHeldRef.current.add(e.code);
    }
    
    if (e.code === 'Space') {
      e.preventDefault();
      isBoostingRef.current = true;
    }
  }, [isSpectating]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
      keysHeldRef.current.delete(e.code);
    }
    
    if (e.code === 'Space') {
      isBoostingRef.current = false;
    }
  }, []);

  // Calculate direction from currently held keys
  const getKeyboardDirection = useCallback(() => {
    const keys = keysHeldRef.current;
    let dx = 0;
    let dy = 0;
    
    if (keys.has('KeyW')) dy -= 1;
    if (keys.has('KeyS')) dy += 1;
    if (keys.has('KeyA')) dx -= 1;
    if (keys.has('KeyD')) dx += 1;
    
    return { dx, dy, active: dx !== 0 || dy !== 0 };
  }, []);


  // Set up event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleMouseMove, handleMouseDown, handleMouseUp, handleKeyDown, handleKeyUp]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Input update loop - send player direction continuously
  useEffect(() => {
    if (isSpectating) return;

    const inputInterval = setInterval(() => {
      const state = gameStateRef.current;
      const playerSnake = state.snakes.find(s => s.id === playerId);
      if (!playerSnake || !playerSnake.isAlive) return;

      const head = playerSnake.segments[0];
      let targetX: number;
      let targetY: number;

      // Check keyboard direction first
      const keyboardDir = getKeyboardDirection();

      // Priority: 1. Keyboard (WASD), 2. Mobile Joystick, 3. Continue current direction
      // NOTE: Mouse is NOT used for movement - only click for boost
      if (keyboardDir.active) {
        targetX = head.x + keyboardDir.dx * 100;
        targetY = head.y + keyboardDir.dy * 100;
      } else if (isMobile && joystickRef.current.active) {
        targetX = head.x + joystickRef.current.dx * 100;
        targetY = head.y + joystickRef.current.dy * 100;
      } else {
        targetX = head.x + Math.cos(playerSnake.direction) * 100;
        targetY = head.y + Math.sin(playerSnake.direction) * 100;
      }

      onInput(targetX, targetY, isBoostingRef.current);
    }, 16);

    return () => clearInterval(inputInterval);
  }, [playerId, onInput, isMobile, isSpectating, getKeyboardDirection]);

  // Render loop (stable; uses refs so it doesn't restart every tick)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const state = gameStateRef.current;

      // Update camera position to follow player or spectate target
      const targetId = isSpectating && spectateTargetId ? spectateTargetId : playerId;
      const targetSnake = state.snakes.find(s => s.id === targetId && s.isAlive);

      if (targetSnake) {
        const head = targetSnake.segments[0];
        cameraRef.current.x += (head.x - cameraRef.current.x) * 0.1;
        cameraRef.current.y += (head.y - cameraRef.current.y) * 0.1;
      } else if (isSpectating) {
        const aliveSnake = state.snakes.find(s => s.isAlive);
        if (aliveSnake) {
          const head = aliveSnake.segments[0];
          cameraRef.current.x += (head.x - cameraRef.current.x) * 0.1;
          cameraRef.current.y += (head.y - cameraRef.current.y) * 0.1;
        }
      }

      // Clear canvas
      ctx.fillStyle = 'hsl(240, 30%, 3%)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Mobile zoom-out factor for better visibility (less disadvantage vs PC)
      const zoomScale = isMobile ? 0.7 : 1;
      
      // Visible world bounds for culling (adjusted for zoom)
      const halfW = (canvas.width / 2) / zoomScale;
      const halfH = (canvas.height / 2) / zoomScale;
      const margin = 300;
      const minX = cameraRef.current.x - halfW - margin;
      const maxX = cameraRef.current.x + halfW + margin;
      const minY = cameraRef.current.y - halfH - margin;
      const maxY = cameraRef.current.y + halfH + margin;

      // Save context and translate for camera (with zoom)
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-cameraRef.current.x, -cameraRef.current.y);

      drawGrid(ctx, canvas.width, canvas.height);
      drawBoundary(ctx);

      // Draw food (culled)
      for (const food of state.food) {
        if (food.x < minX || food.x > maxX || food.y < minY || food.y > maxY) continue;
        drawFood(ctx, food.x, food.y, food.color, food.value);
      }

      // Draw snakes (player last so they're on top)
      const sortedSnakes = [...state.snakes].sort((a, b) => {
        if (a.id === playerId) return 1;
        if (b.id === playerId) return -1;
        return 0;
      });

      for (const snake of sortedSnakes) {
        if (!snake.isAlive) continue;

        // Do NOT cull by head only; body might still be on screen.
        // Cheap visibility check: sample every 6th segment.
        let visible = false;
        for (let i = 0; i < snake.segments.length; i += 6) {
          const seg = snake.segments[i];
          if (seg.x >= minX && seg.x <= maxX && seg.y >= minY && seg.y <= maxY) {
            visible = true;
            break;
          }
        }
        if (!visible) continue;

        drawSnake(ctx, snake, snake.id === playerId, { minX, maxX, minY, maxY });
      }

      ctx.restore();

      // Draw minimap every frame (throttling caused visible flicker because the whole canvas is cleared each frame)
      drawMinimap(ctx, canvas.width, canvas.height);

      if (isSpectating) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(canvas.width / 2 - 100, 20, 200, 40);
        ctx.font = '18px Rajdhani, sans-serif';
        ctx.fillStyle = '#00ffff';
        ctx.textAlign = 'center';
        ctx.fillText('SPECTATING', canvas.width / 2, 48);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [playerId, isSpectating, spectateTargetId]);

  const drawGrid = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
    ctx.strokeStyle = 'hsla(180, 50%, 15%, 0.3)';
    ctx.lineWidth = 1;

    // Calculate grid bounds based on actual canvas size with extra margin
    const gridSize = 100;
    const halfW = canvasWidth / 2;
    const halfH = canvasHeight / 2;
    const margin = gridSize * 2;
    
    const startX = Math.floor((cameraRef.current.x - halfW - margin) / gridSize) * gridSize;
    const startY = Math.floor((cameraRef.current.y - halfH - margin) / gridSize) * gridSize;
    const endX = Math.ceil((cameraRef.current.x + halfW + margin) / gridSize) * gridSize;
    const endY = Math.ceil((cameraRef.current.y + halfH + margin) / gridSize) * gridSize;

    // Batch all lines into single path for performance
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  };

  const drawBoundary = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'hsla(0, 100%, 50%, 0.5)';
    ctx.lineWidth = 5;
    ctx.setLineDash([20, 10]);
    ctx.strokeRect(0, 0, GAME_CONFIG.MAP_WIDTH, GAME_CONFIG.MAP_HEIGHT);
    ctx.setLineDash([]);
  };

  const drawFood = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    value: number
  ) => {
    const radius = 5 + value * 2;

    // OPTIMIZATION: Glow only for large food items
    ctx.save();
    if (value >= 5) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Inner highlight only for larger food
    if (value >= 3) {
      ctx.beginPath();
      ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
    }

    ctx.restore();
  };

  const drawSnake = (
    ctx: CanvasRenderingContext2D,
    snake: typeof gameState.snakes[0],
    isPlayer: boolean,
    bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  ) => {
    const { segments, color, name, isBoosting } = snake;

    ctx.save();
    
    // OPTIMIZATION: shadowBlur only for player (expensive GPU operation)
    if (isPlayer) {
      ctx.shadowColor = color;
      ctx.shadowBlur = isBoosting ? 12 : 6;
    }

    // OPTIMIZATION: Batch draw body segments as single path (except head)
    ctx.fillStyle = color;
    ctx.beginPath();
    
    for (let i = segments.length - 1; i >= 1; i--) {
      const segment = segments[i];
      if (
        bounds &&
        (segment.x < bounds.minX || segment.x > bounds.maxX || segment.y < bounds.minY || segment.y > bounds.maxY)
      ) {
        continue;
      }

      const alpha = 0.5 + (1 - i / segments.length) * 0.5;
      const radius = segment.radius * (1 - i / segments.length * 0.3);

      ctx.globalAlpha = alpha;
      ctx.moveTo(segment.x + radius, segment.y);
      ctx.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
    }
    ctx.fill(); // Single fill for all body segments

    // Draw head separately (needs eyes)
    const head = segments[0];
    if (!bounds || (head.x >= bounds.minX && head.x <= bounds.maxX && head.y >= bounds.minY && head.y <= bounds.maxY)) {
      const headRadius = head.radius;
      
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
      ctx.fill();

      // Inner glow for head
      ctx.beginPath();
      ctx.arc(head.x, head.y, headRadius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();

      // Eyes
      const eyeOffset = headRadius * 0.5;
      const eyeRadius = headRadius * 0.25;
      const direction = snake.direction;

      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(
        head.x + Math.cos(direction - 0.5) * eyeOffset,
        head.y + Math.sin(direction - 0.5) * eyeOffset,
        eyeRadius,
        0,
        Math.PI * 2
      );
      ctx.arc(
        head.x + Math.cos(direction + 0.5) * eyeOffset,
        head.y + Math.sin(direction + 0.5) * eyeOffset,
        eyeRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Pupils
      const pupilRadius = eyeRadius * 0.5;
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(
        head.x + Math.cos(direction - 0.5) * eyeOffset + Math.cos(direction) * pupilRadius,
        head.y + Math.sin(direction - 0.5) * eyeOffset + Math.sin(direction) * pupilRadius,
        pupilRadius,
        0,
        Math.PI * 2
      );
      ctx.arc(
        head.x + Math.cos(direction + 0.5) * eyeOffset + Math.cos(direction) * pupilRadius,
        head.y + Math.sin(direction + 0.5) * eyeOffset + Math.sin(direction) * pupilRadius,
        pupilRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Draw name above snake head
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.font = '14px Rajdhani, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(name, segments[0].x, segments[0].y - 25);

    ctx.restore();
  };

  const drawMinimap = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const state = gameStateRef.current; // Use ref to avoid flickering
    const minimapSize = 150;
    const padding = 20;
    const x = canvasWidth - minimapSize - padding;
    const y = canvasHeight - minimapSize - padding;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = 'hsla(180, 100%, 50%, 0.3)';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, minimapSize, minimapSize);
    ctx.strokeRect(x, y, minimapSize, minimapSize);

    // Scale factor
    const scale = minimapSize / GAME_CONFIG.MAP_WIDTH;

    // Draw snakes on minimap using gameStateRef
    state.snakes.forEach(snake => {
      if (!snake.isAlive) return;

      const head = snake.segments[0];
      const dotX = x + head.x * scale;
      const dotY = y + head.y * scale;
      const dotRadius = snake.id === playerId ? 4 : 2;

      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = snake.color;
      ctx.fill();
    });

    // Draw player view area
    const viewWidth = canvasWidth * scale;
    const viewHeight = canvasHeight * scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x + cameraRef.current.x * scale - viewWidth / 2,
      y + cameraRef.current.y * scale - viewHeight / 2,
      viewWidth,
      viewHeight
    );
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ touchAction: 'none' }}
      />
      {!isSpectating && (
        <MobileControls
          onDirectionChange={handleMobileDirection}
          onBoostChange={handleMobileBoost}
          isMobile={isMobile}
        />
      )}
    </>
  );
};

export default GameCanvas;
