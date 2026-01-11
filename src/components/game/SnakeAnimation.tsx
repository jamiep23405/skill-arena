import { useEffect, useRef } from 'react';
import { SNAKE_COLORS } from '@/lib/gameTypes';

interface AnimatedSnake {
  segments: { x: number; y: number }[];
  color: string;
  speed: number;
  direction: number;
}

const SnakeAnimation = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const snakesRef = useRef<AnimatedSnake[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create some animated snakes
    const createSnake = (): AnimatedSnake => {
      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height;
      const direction = Math.random() * Math.PI * 2;
      const length = 15 + Math.floor(Math.random() * 20);
      const segments = [];

      for (let i = 0; i < length; i++) {
        segments.push({
          x: startX - Math.cos(direction) * i * 12,
          y: startY - Math.sin(direction) * i * 12,
        });
      }

      return {
        segments,
        color: SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)],
        speed: 1 + Math.random() * 2,
        direction,
      };
    };

    snakesRef.current = Array(5).fill(null).map(createSnake);

    const animate = () => {
      ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      snakesRef.current.forEach((snake) => {
        // Slightly change direction
        snake.direction += (Math.random() - 0.5) * 0.1;

        // Move head
        const head = snake.segments[0];
        const newHead = {
          x: head.x + Math.cos(snake.direction) * snake.speed,
          y: head.y + Math.sin(snake.direction) * snake.speed,
        };

        // Wrap around screen
        if (newHead.x < -50) newHead.x = canvas.width + 50;
        if (newHead.x > canvas.width + 50) newHead.x = -50;
        if (newHead.y < -50) newHead.y = canvas.height + 50;
        if (newHead.y > canvas.height + 50) newHead.y = -50;

        snake.segments.unshift(newHead);
        snake.segments.pop();

        // Draw snake with glow
        ctx.save();
        ctx.shadowColor = snake.color;
        ctx.shadowBlur = 15;

        snake.segments.forEach((segment, i) => {
          const alpha = 1 - (i / snake.segments.length) * 0.7;
          const radius = 8 - (i / snake.segments.length) * 4;

          ctx.beginPath();
          ctx.arc(segment.x, segment.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = snake.color;
          ctx.globalAlpha = alpha * 0.3;
          ctx.fill();
        });

        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
    />
  );
};

export default SnakeAnimation;
