import { Point, Snake, SnakeSegment, Food, GAME_CONFIG, SNAKE_COLORS } from './gameTypes';

// Generate a unique ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

// Get random position within map bounds
export const getRandomPosition = (): Point => {
  const padding = 100;
  return {
    x: padding + Math.random() * (GAME_CONFIG.MAP_WIDTH - padding * 2),
    y: padding + Math.random() * (GAME_CONFIG.MAP_HEIGHT - padding * 2),
  };
};

// Get random snake color
export const getRandomColor = (): string => {
  return SNAKE_COLORS[Math.floor(Math.random() * SNAKE_COLORS.length)];
};

// Create initial snake segments
export const createSnakeSegments = (startPos: Point, direction: number): SnakeSegment[] => {
  const segments: SnakeSegment[] = [];
  
  for (let i = 0; i < GAME_CONFIG.INITIAL_LENGTH; i++) {
    segments.push({
      x: startPos.x - Math.cos(direction) * i * GAME_CONFIG.SEGMENT_SPACING,
      y: startPos.y - Math.sin(direction) * i * GAME_CONFIG.SEGMENT_SPACING,
      radius: GAME_CONFIG.SEGMENT_RADIUS,
    });
  }
  
  return segments;
};

// Create a new snake
export const createSnake = (id: string, name: string, color: string): Snake => {
  const startPos = getRandomPosition();
  const direction = Math.random() * Math.PI * 2;
  
  return {
    id,
    name,
    color,
    segments: createSnakeSegments(startPos, direction),
    direction,
    speed: GAME_CONFIG.BASE_SPEED,
    score: GAME_CONFIG.INITIAL_LENGTH,
    isBoosting: false,
    isAlive: true,
    kills: 0,
  };
};

// Create food item with varying sizes
export const createFood = (): Food => {
  const pos = getRandomPosition();
  const rand = Math.random();
  
  // Varied food values: 60% small (1), 25% medium (3), 10% large (5), 5% huge (10)
  let value: number;
  let color: string;
  
  if (rand < 0.60) {
    value = 1;
    color = getRandomColor();
  } else if (rand < 0.85) {
    value = 3;
    color = '#00ff88'; // green glow
  } else if (rand < 0.95) {
    value = 5;
    color = '#ffff00'; // yellow
  } else {
    value = 10;
    color = '#ff00ff'; // magenta for rare huge food
  }
  
  return {
    id: generateId(),
    x: pos.x,
    y: pos.y,
    value,
    color,
  };
};

// Calculate distance between two points
export const distance = (p1: Point, p2: Point): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Calculate angle between two points
export const angleBetween = (from: Point, to: Point): number => {
  return Math.atan2(to.y - from.y, to.x - from.x);
};

// Normalize angle to -PI to PI
export const normalizeAngle = (angle: number): number => {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
};

// Check collision between head and another snake
// OPTIMIZATION: Bounding-box quick-reject + segment sampling
export const checkSnakeCollision = (
  head: SnakeSegment,
  otherSnake: Snake,
  isSelf: boolean = false,
): boolean => {
  // Self-collision: skip neck/nearby segments to avoid false positives on turns
  // For other snakes: check from segment 1 (skip head only)
  const startIndex = isSelf ? 25 : 1;

  // OPTIMIZATION: Quick-reject using bounding box around other snake
  if (!isSelf) {
    const otherHead = otherSnake.segments[0];
    const roughDist = Math.abs(head.x - otherHead.x) + Math.abs(head.y - otherHead.y);
    const maxLength = otherSnake.segments.length * GAME_CONFIG.SEGMENT_SPACING;
    // More generous quick-reject to not miss any collisions
    if (roughDist > maxLength + 100) {
      return false; // Too far away, no collision possible
    }
  }

  // Collision multiplier - FIXED: was 0.6 which made snakes pass through each other
  // 0.85 gives accurate visual collision while allowing slight overlap for smoother gameplay
  const collisionMultiplier = 0.85;

  // Check every 2nd segment for accuracy (was every 5th - too sparse!)
  // For self-collision, check every segment
  const step = isSelf ? 1 : 2;
  
  for (let i = startIndex; i < otherSnake.segments.length; i += step) {
    const segment = otherSnake.segments[i];
    const dist = distance(head, segment);
    const collisionDist = (head.radius + segment.radius) * collisionMultiplier;
    if (dist < collisionDist) {
      return true;
    }
  }

  return false;
};

// Check collision between head and food
export const checkFoodCollision = (head: SnakeSegment, food: Food): boolean => {
  return distance(head, food) < head.radius + 10;
};

// Format time as MM:SS
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Lerp between two values
export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

// Clamp value between min and max
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

// Check if point is within map bounds
export const isInBounds = (point: Point): boolean => {
  return (
    point.x >= 0 &&
    point.x <= GAME_CONFIG.MAP_WIDTH &&
    point.y >= 0 &&
    point.y <= GAME_CONFIG.MAP_HEIGHT
  );
};

// HSL to hex color conversion
export const hslToHex = (h: number, s: number, l: number): string => {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// ========== SPATIAL HASH FOR PERFORMANCE ==========
// Index ALL snake segments for proper collision detection
const SPATIAL_CELL_SIZE = 200;

export interface SpatialHash {
  cells: Map<string, Set<string>>; // Use Set to avoid duplicates
}

function getCellKey(x: number, y: number): string {
  return `${Math.floor(x / SPATIAL_CELL_SIZE)},${Math.floor(y / SPATIAL_CELL_SIZE)}`;
}

/**
 * Build spatial hash indexing ALL segments of all snakes (not just heads)
 * This fixes the bug where enemy bodies weren't detected for collision
 */
export function buildSpatialHash(snakes: { id: string; segments: { x: number; y: number }[]; isAlive: boolean }[]): SpatialHash {
  const cells = new Map<string, Set<string>>();
  
  for (const snake of snakes) {
    if (!snake.isAlive) continue;
    
    // Index every 5th segment to balance performance and accuracy
    for (let i = 0; i < snake.segments.length; i += 5) {
      const seg = snake.segments[i];
      const key = getCellKey(seg.x, seg.y);
      if (!cells.has(key)) cells.set(key, new Set());
      cells.get(key)!.add(snake.id);
    }
  }
  
  return { cells };
}

/**
 * Get snake IDs that have segments near the given position
 * Checks a 5x5 grid of cells for better coverage of long snakes
 */
export function getNearbySnakeIds(hash: SpatialHash, x: number, y: number): string[] {
  const nearby = new Set<string>();
  
  // Check 5x5 grid of cells around position (was 3x3 - too small)
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const key = getCellKey(x + dx * SPATIAL_CELL_SIZE, y + dy * SPATIAL_CELL_SIZE);
      const ids = hash.cells.get(key);
      if (ids) {
        ids.forEach(id => nearby.add(id));
      }
    }
  }
  
  return Array.from(nearby);
}
