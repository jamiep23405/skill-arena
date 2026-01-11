// Core game types for the snake game

export interface Point {
  x: number;
  y: number;
}

export interface SnakeSegment extends Point {
  radius: number;
}

export interface Snake {
  id: string;
  name: string;
  color: string;
  segments: SnakeSegment[];
  direction: number; // angle in radians
  speed: number;
  score: number;
  isBoosting: boolean;
  isAlive: boolean;
  kills: number;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  value: number;
  color: string;
}

export interface GameState {
  snakes: Map<string, Snake>;
  food: Food[];
  timeRemaining: number; // in seconds
  matchId: string;
  status: 'waiting' | 'starting' | 'playing' | 'ended';
}

export interface PlayerInput {
  playerId: string;
  targetX: number;
  targetY: number;
  isBoosting: boolean;
}

// WebSocket message types
export type ClientMessage =
  | { type: 'join'; playerId: string; playerName: string; color: string }
  | { type: 'input'; targetX: number; targetY: number; isBoosting: boolean }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'game_state'; state: SerializedGameState }
  | { type: 'player_joined'; playerId: string; playerName: string; color: string }
  | { type: 'player_left'; playerId: string }
  | { type: 'player_killed'; killerId: string; victimId: string; pointsTransferred: number }
  | { type: 'match_start'; matchId: string; players: { id: string; name: string; color: string }[] }
  | { type: 'match_end'; winnerId: string; finalScores: { playerId: string; name: string; score: number; kills: number }[] }
  | { type: 'countdown'; seconds: number }
  | { type: 'error'; message: string };

// Serialized version for network transmission
export interface SerializedGameState {
  snakes: SerializedSnake[];
  food: Food[];
  timeRemaining: number;
  matchId: string;
  status: 'waiting' | 'starting' | 'playing' | 'ended';
}

export interface SerializedSnake {
  id: string;
  name: string;
  color: string;
  segments: SnakeSegment[];
  direction: number;
  speed: number;
  score: number;
  isBoosting: boolean;
  isAlive: boolean;
  kills: number;
}

// Game constants
export const GAME_CONFIG = {
  MAP_WIDTH: 5000,
  MAP_HEIGHT: 5000,
  BASE_SPEED: 3.54, // 18% faster (was 3)
  BOOST_SPEED: 7.08, // 18% faster (was 6)
  BOOST_COST_PER_TICK: 0.1, // points consumed per game tick while boosting
  INITIAL_LENGTH: 10,
  SEGMENT_RADIUS: 12 as number,
  SEGMENT_SPACING: 8,
  FOOD_SPAWN_RATE: 236, // 18% more food (was 200)
  MATCH_DURATION: 180, // 3 minutes in seconds
  TOTAL_PLAYERS: 30, // always 30 players per match
  LOBBY_WAIT_TIME: 5, // seconds to wait for players before filling with bots
  TICK_RATE: 20, // server ticks per second
  TURN_RATE: 0.15, // how fast snakes can turn (radians per tick)
} as const;

// Snake colors for players
export const SNAKE_COLORS = [
  '#00ffff', // cyan
  '#ff00ff', // magenta
  '#00ff00', // lime
  '#ff6600', // orange
  '#9933ff', // purple
  '#ff3399', // pink
  '#ffff00', // yellow
  '#3399ff', // blue
  '#ff3333', // red
  '#33ff99', // mint
] as const;
