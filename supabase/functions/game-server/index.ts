import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Game constants
const GAME_CONFIG = {
  MAP_WIDTH: 5000,
  MAP_HEIGHT: 5000,
  BASE_SPEED: 3,
  BOOST_SPEED: 6,
  BOOST_COST_PER_TICK: 0.1,
  INITIAL_LENGTH: 10,
  SEGMENT_RADIUS: 12,
  SEGMENT_SPACING: 8,
  FOOD_SPAWN_RATE: 200,
  MATCH_DURATION: 180,
  TOTAL_PLAYERS: 30,
  LOBBY_WAIT_TIME: 5,
  TICK_RATE: 20,
  TURN_RATE: 0.15,
};

// Types
interface Point {
  x: number;
  y: number;
}

interface SnakeSegment extends Point {
  radius: number;
}

interface Snake {
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

interface Food {
  id: string;
  x: number;
  y: number;
  value: number;
  color: string;
}

interface PlayerInput {
  targetX: number;
  targetY: number;
  isBoosting: boolean;
}

interface GameRoom {
  id: string;
  matchId: string | null;
  status: 'waiting' | 'starting' | 'playing' | 'ended';
  players: Map<string, { socket: WebSocket; snake: Snake; input: PlayerInput }>;
  food: Food[];
  timeRemaining: number;
  tickInterval: number | null;
}

// Active game rooms
const rooms = new Map<string, GameRoom>();

// Utility functions
const generateId = (): string => Math.random().toString(36).substring(2, 15);

const getRandomPosition = (): Point => {
  const padding = 100;
  return {
    x: padding + Math.random() * (GAME_CONFIG.MAP_WIDTH - padding * 2),
    y: padding + Math.random() * (GAME_CONFIG.MAP_HEIGHT - padding * 2),
  };
};

const distance = (p1: Point, p2: Point): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const angleBetween = (from: Point, to: Point): number => {
  return Math.atan2(to.y - from.y, to.x - from.x);
};

const normalizeAngle = (angle: number): number => {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
};

const createSnakeSegments = (startPos: Point, direction: number): SnakeSegment[] => {
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

const createSnake = (id: string, name: string, color: string): Snake => {
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

const createFood = (): Food => {
  const pos = getRandomPosition();
  const colors = ['#00ffff', '#ff00ff', '#00ff00', '#ff6600', '#9933ff', '#ff3399', '#ffff00'];
  const rand = Math.random();
  
  // Varied food: 60% small (1), 25% medium (3), 10% large (5), 5% huge (10)
  let value: number;
  let color: string;
  
  if (rand < 0.60) {
    value = 1;
    color = colors[Math.floor(Math.random() * colors.length)];
  } else if (rand < 0.85) {
    value = 3;
    color = '#00ff88';
  } else if (rand < 0.95) {
    value = 5;
    color = '#ffff00';
  } else {
    value = 10;
    color = '#ff00ff';
  }
  
  return {
    id: generateId(),
    x: pos.x,
    y: pos.y,
    value,
    color,
  };
};

const checkSnakeCollision = (head: SnakeSegment, otherSnake: Snake, skipHead: boolean = false): boolean => {
  const startIndex = skipHead ? 3 : 0;
  for (let i = startIndex; i < otherSnake.segments.length; i++) {
    const segment = otherSnake.segments[i];
    const dist = distance(head, segment);
    if (dist < head.radius + segment.radius) {
      return true;
    }
  }
  return false;
};

const checkFoodCollision = (head: SnakeSegment, food: Food): boolean => {
  return distance(head, food) < head.radius + 10;
};

// Broadcast message to all players in a room
const broadcast = (room: GameRoom, message: object, excludeId?: string) => {
  const messageStr = JSON.stringify(message);
  room.players.forEach((player, id) => {
    if (id !== excludeId && player.socket.readyState === WebSocket.OPEN) {
      try {
        player.socket.send(messageStr);
      } catch (e) {
        console.error(`Error sending to player ${id}:`, e);
      }
    }
  });
};

// Find or create a room
const findOrCreateRoom = (): GameRoom => {
  // Find a waiting room that hasn't started yet
  for (const [, room] of rooms) {
    if (room.status === 'waiting' && room.players.size < GAME_CONFIG.TOTAL_PLAYERS) {
      return room;
    }
  }

  // Create new room
  const roomId = generateId();
  const room: GameRoom = {
    id: roomId,
    matchId: null,
    status: 'waiting',
    players: new Map(),
    food: [],
    timeRemaining: GAME_CONFIG.MATCH_DURATION,
    tickInterval: null,
  };
  rooms.set(roomId, room);
  console.log(`Created new room: ${roomId}`);
  return room;
};

// Start the game
const startGame = (room: GameRoom) => {
  console.log(`Starting game in room ${room.id} with ${room.players.size} players`);
  room.status = 'playing';
  room.matchId = generateId();
  room.timeRemaining = GAME_CONFIG.MATCH_DURATION;

  // Initialize food
  room.food = [];
  for (let i = 0; i < GAME_CONFIG.FOOD_SPAWN_RATE; i++) {
    room.food.push(createFood());
  }

  // Broadcast match start
  const playerList = Array.from(room.players.entries()).map(([id, p]) => ({
    id,
    name: p.snake.name,
    color: p.snake.color,
  }));

  broadcast(room, {
    type: 'match_start',
    matchId: room.matchId,
    players: playerList,
  });

  // Start game loop
  const tickMs = 1000 / GAME_CONFIG.TICK_RATE;
  room.tickInterval = setInterval(() => gameTick(room), tickMs) as unknown as number;
};

// Game tick
const gameTick = (room: GameRoom) => {
  if (room.status !== 'playing') return;

  // Update time
  room.timeRemaining -= 1 / GAME_CONFIG.TICK_RATE;
  
  if (room.timeRemaining <= 0) {
    endGame(room);
    return;
  }

  // Track deaths across the tick (including border collisions)
  const deadSnakes = new Set<string>();

  // Update each snake
  room.players.forEach((player) => {
    const snake = player.snake;
    if (!snake.isAlive) return;

    const head = snake.segments[0];
    const input = player.input;

    // Calculate target angle
    const targetAngle = angleBetween(head, { x: input.targetX, y: input.targetY });

    // Smooth turning
    let angleDiff = normalizeAngle(targetAngle - snake.direction);
    if (Math.abs(angleDiff) > GAME_CONFIG.TURN_RATE) {
      angleDiff = Math.sign(angleDiff) * GAME_CONFIG.TURN_RATE;
    }
    snake.direction = snake.direction + angleDiff;

    // Speed and boosting (frontend handles boost-energy bar; server drains score only when used there)
    const canBoost = input.isBoosting && snake.score > GAME_CONFIG.INITIAL_LENGTH;
    snake.speed = canBoost ? GAME_CONFIG.BOOST_SPEED : GAME_CONFIG.BASE_SPEED;
    snake.isBoosting = canBoost;

    // Keep existing behavior here for now to avoid desync (will be updated when WS gameplay is enabled)
    if (canBoost) {
      snake.score = Math.max(GAME_CONFIG.INITIAL_LENGTH, snake.score - GAME_CONFIG.BOOST_COST_PER_TICK);
    }

    // Move head
    const newHead: SnakeSegment = {
      x: head.x + Math.cos(snake.direction) * snake.speed,
      y: head.y + Math.sin(snake.direction) * snake.speed,
      radius: GAME_CONFIG.SEGMENT_RADIUS,
    };

    // Border collision kills
    if (
      newHead.x < GAME_CONFIG.SEGMENT_RADIUS ||
      newHead.x > GAME_CONFIG.MAP_WIDTH - GAME_CONFIG.SEGMENT_RADIUS ||
      newHead.y < GAME_CONFIG.SEGMENT_RADIUS ||
      newHead.y > GAME_CONFIG.MAP_HEIGHT - GAME_CONFIG.SEGMENT_RADIUS
    ) {
      deadSnakes.add(snake.id);
      return;
    }

    // Update segments
    const newSegments = [newHead];
    for (let i = 1; i < snake.segments.length; i++) {
      const prevSeg = newSegments[i - 1];
      const currSeg = snake.segments[i];
      const dist = distance(prevSeg, currSeg);

      if (dist > GAME_CONFIG.SEGMENT_SPACING) {
        const angle = angleBetween(currSeg, prevSeg);
        newSegments.push({
          x: prevSeg.x - Math.cos(angle) * GAME_CONFIG.SEGMENT_SPACING,
          y: prevSeg.y - Math.sin(angle) * GAME_CONFIG.SEGMENT_SPACING,
          radius: GAME_CONFIG.SEGMENT_RADIUS,
        });
      } else {
        newSegments.push({ ...currSeg });
      }
    }

    // Adjust length based on score
    const targetLength = Math.floor(snake.score);
    while (newSegments.length < targetLength) {
      const lastSeg = newSegments[newSegments.length - 1];
      newSegments.push({ ...lastSeg });
    }
    while (newSegments.length > targetLength && newSegments.length > GAME_CONFIG.INITIAL_LENGTH) {
      newSegments.pop();
    }

    snake.segments = newSegments;
  });

  // Check collisions
  const kills: { killerId: string; victimId: string; points: number }[] = [];

  room.players.forEach((player, playerId) => {
    const snake = player.snake;
    if (!snake.isAlive || deadSnakes.has(playerId)) return;

    const head = snake.segments[0];

    // Check collision with other snakes
    room.players.forEach((otherPlayer, otherId) => {
      if (otherId === playerId || !otherPlayer.snake.isAlive || deadSnakes.has(otherId)) return;

      if (checkSnakeCollision(head, otherPlayer.snake, false)) {
        deadSnakes.add(playerId);
        kills.push({ killerId: otherId, victimId: playerId, points: snake.score });
      }
    });

    // Check self-collision
    if (snake.segments.length > 20 && checkSnakeCollision(head, snake, true)) {
      deadSnakes.add(playerId);
    }
  });

  // Apply deaths
  deadSnakes.forEach(playerId => {
    const player = room.players.get(playerId);
    if (player) {
      // Drop food
      player.snake.segments.forEach((seg, i) => {
        if (i % 3 === 0) {
          room.food.push({
            id: generateId(),
            x: seg.x + (Math.random() - 0.5) * 20,
            y: seg.y + (Math.random() - 0.5) * 20,
            value: 2,
            color: player.snake.color,
          });
        }
      });
      player.snake.isAlive = false;
    }
  });

  // Award kills
  kills.forEach(kill => {
    const killer = room.players.get(kill.killerId);
    if (killer) {
      killer.snake.kills++;
      killer.snake.score += kill.points;
    }

    broadcast(room, {
      type: 'player_killed',
      killerId: kill.killerId,
      victimId: kill.victimId,
      pointsTransferred: kill.points,
    });
  });

  // Check food collection
  room.players.forEach((player) => {
    if (!player.snake.isAlive) return;

    const head = player.snake.segments[0];
    room.food = room.food.filter(food => {
      if (checkFoodCollision(head, food)) {
        player.snake.score += food.value;
        return false;
      }
      return true;
    });
  });

  // Spawn new food
  while (room.food.length < GAME_CONFIG.FOOD_SPAWN_RATE) {
    room.food.push(createFood());
  }

  // Broadcast game state
  const snakes = Array.from(room.players.values()).map(p => ({
    id: p.snake.id,
    name: p.snake.name,
    color: p.snake.color,
    segments: p.snake.segments,
    direction: p.snake.direction,
    speed: p.snake.speed,
    score: p.snake.score,
    isBoosting: p.snake.isBoosting,
    isAlive: p.snake.isAlive,
    kills: p.snake.kills,
  }));

  broadcast(room, {
    type: 'game_state',
    state: {
      snakes,
      food: room.food,
      timeRemaining: room.timeRemaining,
      matchId: room.matchId,
      status: room.status,
    },
  });
};

// End game
const endGame = (room: GameRoom) => {
  console.log(`Game ended in room ${room.id}`);
  room.status = 'ended';

  if (room.tickInterval) {
    clearInterval(room.tickInterval);
    room.tickInterval = null;
  }

  // Calculate final scores
  const finalScores = Array.from(room.players.values())
    .map(p => ({
      playerId: p.snake.id,
      name: p.snake.name,
      score: Math.floor(p.snake.score),
      kills: p.snake.kills,
    }))
    .sort((a, b) => b.score - a.score);

  const winnerId = finalScores[0]?.playerId || '';

  broadcast(room, {
    type: 'match_end',
    winnerId,
    finalScores,
  });

  // Clean up room after a delay
  setTimeout(() => {
    rooms.delete(room.id);
    console.log(`Room ${room.id} cleaned up`);
  }, 5000);
};

// Handle WebSocket connection
const handleConnection = (socket: WebSocket) => {
  let room: GameRoom | null = null;
  let playerId: string | null = null;

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log(`Received message:`, message.type);

      switch (message.type) {
        case 'join': {
          room = findOrCreateRoom();
          const newPlayerId = message.playerId || generateId();
          playerId = newPlayerId;
          const playerName = message.playerName || 'Player';
          const playerColor = message.color || '#00ffff';

          const snake = createSnake(newPlayerId, playerName, playerColor);
          room.players.set(newPlayerId, {
            socket,
            snake,
            input: { targetX: snake.segments[0].x, targetY: snake.segments[0].y, isBoosting: false },
          });

          console.log(`Player ${newPlayerId} (${playerName}) joined room ${room.id}. Total: ${room.players.size}`);

          // Notify other players
          broadcast(room, {
            type: 'player_joined',
            playerId: newPlayerId,
            playerName,
            color: playerColor,
          }, newPlayerId);

          // Send room state to joining player
          socket.send(JSON.stringify({
            type: 'room_joined',
            roomId: room.id,
            playerId,
            playerCount: room.players.size,
            totalPlayers: GAME_CONFIG.TOTAL_PLAYERS,
            status: room.status,
          }));

          // Game start is now handled by the lobby/frontend
          // The edge function just manages the game state once started
          break;
        }

        case 'input': {
          if (room && playerId) {
            const player = room.players.get(playerId);
            if (player) {
              player.input = {
                targetX: message.targetX,
                targetY: message.targetY,
                isBoosting: message.isBoosting,
              };
            }
          }
          break;
        }

        case 'leave': {
          handleDisconnect();
          break;
        }
      }
    } catch (e) {
      console.error('Error handling message:', e);
    }
  };

  const handleDisconnect = () => {
    if (room && playerId) {
      room.players.delete(playerId);
      console.log(`Player ${playerId} left room ${room.id}. Remaining: ${room.players.size}`);

      broadcast(room, { type: 'player_left', playerId });

      // Clean up empty rooms
      if (room.players.size === 0) {
        if (room.tickInterval) {
          clearInterval(room.tickInterval);
        }
        rooms.delete(room.id);
        console.log(`Room ${room.id} deleted (empty)`);
      }
    }
  };

  socket.onclose = handleDisconnect;
  socket.onerror = (e) => {
    console.error('WebSocket error:', e);
    handleDisconnect();
  };
};

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  // Check for WebSocket upgrade
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response(JSON.stringify({ 
      status: 'ok', 
      message: 'Snake Game Server',
      rooms: rooms.size,
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Upgrade to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  console.log('New WebSocket connection');
  handleConnection(socket);

  return response;
});
