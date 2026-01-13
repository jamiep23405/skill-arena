import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  SerializedGameState, 
  SerializedSnake, 
  Food, 
  GAME_CONFIG 
} from '@/lib/gameTypes';
import { 
  createSnake, 
  createFood, 
  distance, 
  angleBetween, 
  normalizeAngle,
  checkSnakeCollision,
  generateId,
  buildSpatialHash,
  getNearbySnakeIds,
} from '@/lib/gameUtils';
import { BotState, createBotState, calculateBotMove, activateLootCollection } from '@/lib/botAI';

interface UseGameStateReturn {
  gameState: SerializedGameState;
  updateGameState: (state: Partial<SerializedGameState>) => void;
  handlePlayerInput: (targetX: number, targetY: number, isBoosting: boolean) => void;
  getBoostEnergy: (snakeId: string) => number;
}

export const useGameState = (playerId: string): UseGameStateReturn => {
  const [gameState, setGameState] = useState<SerializedGameState>({
    snakes: [],
    food: [],
    timeRemaining: GAME_CONFIG.MATCH_DURATION,
    matchId: '',
    status: 'waiting',
  });

  // Track boost energy separately (0-100)
  const boostEnergyRef = useRef<Map<string, number>>(new Map());
  const botStatesRef = useRef<Map<string, BotState>>(new Map());
  const inputRef = useRef({ targetX: 0, targetY: 0, isBoosting: false });
  const gameLoopRef = useRef<number>();
  const tickCounterRef = useRef(0); // For bot update staggering

  const updateGameState = useCallback((state: Partial<SerializedGameState>) => {
    setGameState(prev => ({ ...prev, ...state }));
  }, []);

  const handlePlayerInput = useCallback((targetX: number, targetY: number, isBoosting: boolean) => {
    inputRef.current = { targetX, targetY, isBoosting };
  }, []);

  const getBoostEnergy = useCallback((snakeId: string): number => {
    return boostEnergyRef.current.get(snakeId) ?? 50;
  }, []);

  // Initialize game with players from sessionStorage
  useEffect(() => {
    if (gameState.status !== 'playing') return;

    const init = () => {
      // Read players from sessionStorage (set by Lobby)
      const storedPlayers = sessionStorage.getItem('gamePlayers');
      
      if (storedPlayers) {
        try {
          const players = JSON.parse(storedPlayers);
          const snakes: SerializedSnake[] = players.map((p: any) => {
            // Initialize boost energy for each snake
            if (!boostEnergyRef.current.has(p.player_id)) {
              boostEnergyRef.current.set(p.player_id, 50);
            }
            return createSnake(p.player_id, p.player_name, p.snake_color);
          });

          // Create initial food
          const initialFood: Food[] = [];
          for (let i = 0; i < GAME_CONFIG.FOOD_SPAWN_RATE; i++) {
            initialFood.push(createFood());
          }

          setGameState(prev => ({
            ...prev,
            snakes,
            food: initialFood,
          }));
          return;
        } catch (err) {
          console.error('Error parsing stored players:', err);
        }
      }

      // Fallback: create local game with bots
      const playerName = sessionStorage.getItem('playerName') || 'Player';
      const playerColor = sessionStorage.getItem('playerColor') || '#00ffff';
      const playerSnake = createSnake(playerId, playerName, playerColor);
      if (!boostEnergyRef.current.has(playerId)) boostEnergyRef.current.set(playerId, 50);

      const botSnakes: SerializedSnake[] = [];
      const botCount = 15;
      for (let i = 0; i < botCount; i++) {
        const botId = `bot_${generateId()}`;
        const colors = ['#ff00ff', '#00ff00', '#ff6600', '#9933ff', '#ff3399', '#ffff00', '#3399ff', '#ff3333', '#33ff99'];
        const botSnake = createSnake(botId, `Bot ${i + 1}`, colors[i % colors.length]);
        boostEnergyRef.current.set(botId, 50);
        botSnakes.push(botSnake);
      }

      const initialFood: Food[] = [];
      for (let i = 0; i < GAME_CONFIG.FOOD_SPAWN_RATE; i++) {
        initialFood.push(createFood());
      }

      setGameState(prev => ({
        ...prev,
        snakes: [playerSnake, ...botSnakes],
        food: initialFood,
      }));
    };

    init();
  }, [gameState.status, playerId]);

  // Game loop
  useEffect(() => {
    if (gameState.status !== 'playing') return;

    // Use a fixed timestep for more consistent gameplay
    const TICK_RATE = 1000 / 60; // 60 FPS target
    let lastTime = performance.now();
    let accumulator = 0;

    const tick = () => {
      const now = performance.now();
      const frameTime = Math.min(now - lastTime, 50); // Cap at 50ms to prevent spiral of death
      lastTime = now;
      accumulator += frameTime;

      // Only update when we have enough accumulated time
      if (accumulator < TICK_RATE) {
        gameLoopRef.current = requestAnimationFrame(tick);
        return;
      }

      const delta = accumulator / 1000;
      accumulator = 0;
      
      // OPTIMIZATION: Increment tick counter for bot staggering
      tickCounterRef.current++;

      setGameState(prev => {
        if (prev.status !== 'playing') return prev;

        // Update time
        const newTimeRemaining = Math.max(0, prev.timeRemaining - delta);
        
        if (newTimeRemaining <= 0) {
          return { ...prev, timeRemaining: 0, status: 'ended' };
        }

        // OPTIMIZATION: Track bot index for staggered updates
        let botIndex = 0;

        // Update snakes
        const newSnakes = prev.snakes.map(snake => {
          // CRITICAL: Dead snakes should not be updated at all - prevents ghost movement
          if (!snake.isAlive) return snake;

          const head = snake.segments[0];
          let targetAngle: number;
          let isBoosting = false;

          // Player input
          if (snake.id === playerId) {
            const { targetX, targetY, isBoosting: wantsToBoosting } = inputRef.current;
            targetAngle = angleBetween(head, { x: targetX, y: targetY });
            
          // Get or initialize boost energy
            let boostEnergy = boostEnergyRef.current.get(snake.id) ?? 50;
            
            // Can boost if has energy AND has enough score (minimum 5 to boost)
            if (wantsToBoosting && boostEnergy > 0 && snake.score > GAME_CONFIG.INITIAL_LENGTH) {
              isBoosting = true;
              boostEnergy = Math.max(0, boostEnergy - 0.5); // Drain boost energy
            } else {
              // Recharge boost when not boosting (slower rate)
              boostEnergy = Math.min(100, boostEnergy + 0.1);
            }
            
            boostEnergyRef.current.set(snake.id, boostEnergy);
          } else {
            // OPTIMIZATION: Stagger bot AI updates (only update 1/6 of bots per tick)
            const shouldUpdateBotAI = botIndex % 6 === tickCounterRef.current % 6;
            botIndex++;
            
            // Get or create bot state
            let botState = botStatesRef.current.get(snake.id);
            if (!botState) {
              botState = createBotState();
              botStatesRef.current.set(snake.id, botState);
            }
            
            // Get bot's boost energy
            const botBoostEnergy = boostEnergyRef.current.get(snake.id) ?? 50;
            
            if (shouldUpdateBotAI) {
              // Calculate intelligent move (only on this bot's tick)
              const moveResult = calculateBotMove(
                snake,
                prev.snakes,
                prev.food,
                botState,
                botBoostEnergy
              );
              
              targetAngle = moveResult.targetAngle;
              isBoosting = moveResult.shouldBoost;
            } else {
              // Keep current direction when not updating AI
              targetAngle = snake.direction;
              isBoosting = snake.isBoosting;
            }
            
            // Manage bot boost energy
            if (isBoosting && botBoostEnergy > 0) {
              boostEnergyRef.current.set(snake.id, Math.max(0, botBoostEnergy - 0.5));
            } else {
              boostEnergyRef.current.set(snake.id, Math.min(100, botBoostEnergy + 0.1));
            }
          }

          // Smooth turning
          let angleDiff = normalizeAngle(targetAngle - snake.direction);
          if (Math.abs(angleDiff) > GAME_CONFIG.TURN_RATE) {
            angleDiff = Math.sign(angleDiff) * GAME_CONFIG.TURN_RATE;
          }
          const newDirection = snake.direction + angleDiff;

          // Speed and boosting - boost drains score (points)
          const speed = isBoosting ? GAME_CONFIG.BOOST_SPEED : GAME_CONFIG.BASE_SPEED;
          // Drain 0.1 points per tick while boosting (snake gets shorter slowly)
          const newScore = isBoosting ? Math.max(GAME_CONFIG.INITIAL_LENGTH, snake.score - 0.1) : snake.score;

          // Move head
          const newHead = {
            x: head.x + Math.cos(newDirection) * speed,
            y: head.y + Math.sin(newDirection) * speed,
            radius: GAME_CONFIG.SEGMENT_RADIUS,
          };

          // Check if hitting border - mark for death
          const hitBorder = newHead.x < GAME_CONFIG.SEGMENT_RADIUS || 
                           newHead.x > GAME_CONFIG.MAP_WIDTH - GAME_CONFIG.SEGMENT_RADIUS ||
                           newHead.y < GAME_CONFIG.SEGMENT_RADIUS || 
                           newHead.y > GAME_CONFIG.MAP_HEIGHT - GAME_CONFIG.SEGMENT_RADIUS;
          
          if (hitBorder) {
            // Clamp position to border for visual effect before death
            newHead.x = Math.max(GAME_CONFIG.SEGMENT_RADIUS, Math.min(GAME_CONFIG.MAP_WIDTH - GAME_CONFIG.SEGMENT_RADIUS, newHead.x));
            newHead.y = Math.max(GAME_CONFIG.SEGMENT_RADIUS, Math.min(GAME_CONFIG.MAP_HEIGHT - GAME_CONFIG.SEGMENT_RADIUS, newHead.y));
          }

          // Update segments (follow the leader)
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

          // Adjust segment count based on score
          const targetLength = Math.floor(newScore);
          while (newSegments.length < targetLength) {
            const lastSeg = newSegments[newSegments.length - 1];
            newSegments.push({ ...lastSeg });
          }
          while (newSegments.length > targetLength && newSegments.length > GAME_CONFIG.INITIAL_LENGTH) {
            newSegments.pop();
          }

          return {
            ...snake,
            segments: newSegments,
            direction: newDirection,
            speed,
            score: newScore,
            isBoosting,
            hitBorder, // Track if this snake hit the border
          };
        });

        // Check collisions - collect all dead snakes FIRST before any collision checks
        const deadSnakes = new Set<string>();
        const kills: { killerId: string; victimId: string }[] = [];
        const deathReason = new Map<string, 'border' | 'snake' | 'self'>();
        const deathMeta = new Map<string, any>();

        // First pass: mark snakes that hit border
        newSnakes.forEach(snake => {
          if (!snake.isAlive) return;
          if ((snake as any).hitBorder) {
            deadSnakes.add(snake.id);
            deathReason.set(snake.id, 'border');
            if (snake.id === playerId) {
              deathMeta.set(playerId, {
                head: snake.segments[0],
                map: { w: GAME_CONFIG.MAP_WIDTH, h: GAME_CONFIG.MAP_HEIGHT, r: GAME_CONFIG.SEGMENT_RADIUS },
              });
            }
          }
        });

        // Second pass: check snake-to-snake collisions using spatial hash
        const spatialHash = buildSpatialHash(newSnakes);
        const snakeMap = new Map(newSnakes.map(s => [s.id, s]));
        
        // Use a Set to prevent duplicate collision pairs
        const processedPairs = new Set<string>();
        
        newSnakes.forEach(snake => {
          if (!snake.isAlive || deadSnakes.has(snake.id)) return;

          const head = snake.segments[0];
          
          // Check for head-to-head collisions first
          for (const other of newSnakes) {
            if (other.id === snake.id || !other.isAlive || deadSnakes.has(other.id)) continue;
            
            // Create a unique key for this pair (sorted to avoid A-B and B-A duplicates)
            const pairKey = [snake.id, other.id].sort().join('|');
            if (processedPairs.has(pairKey)) continue;
            processedPairs.add(pairKey);
            
            const otherHead = other.segments[0];
            const dist = distance(head, otherHead);
            // Head-to-head: both heads collide (radius * 2 * 0.85)
            if (dist < (head.radius + otherHead.radius) * 0.85) {
              // Process immediately to avoid race conditions
              const snake1 = snake;
              const snake2 = other;
              
              // If sizes are within 10%, both die (no killer)
              const sizeDiff = Math.abs(snake1.score - snake2.score) / Math.max(snake1.score, snake2.score);
              if (sizeDiff < 0.1) {
                deadSnakes.add(snake1.id);
                deadSnakes.add(snake2.id);
                deathReason.set(snake1.id, 'snake');
                deathReason.set(snake2.id, 'snake');
              } else {
                // Smaller snake dies, bigger gets the kill
                const smallerId = snake1.score < snake2.score ? snake1.id : snake2.id;
                const biggerId = snake1.score >= snake2.score ? snake1.id : snake2.id;
                deadSnakes.add(smallerId);
                deathReason.set(smallerId, 'snake');
                kills.push({ killerId: biggerId, victimId: smallerId });
              }
            }
          }
        });
        
        // Then check head-to-body collisions
        newSnakes.forEach(snake => {
          if (!snake.isAlive || deadSnakes.has(snake.id)) return;

          const head = snake.segments[0];
          
          // Get nearby snakes using spatial hash
          const nearbyIds = getNearbySnakeIds(spatialHash, head.x, head.y);
          
          for (const otherId of nearbyIds) {
            if (otherId === snake.id) continue;
            const other = snakeMap.get(otherId);
            if (!other || !other.isAlive || deadSnakes.has(otherId)) continue;

            // Check if our head hits their body (not head - that's handled above)
            if (checkSnakeCollision(head, other, false)) {
              deadSnakes.add(snake.id);
              deathReason.set(snake.id, 'snake');
              kills.push({ killerId: other.id, victimId: snake.id });

              if (snake.id === playerId) {
                const otherSeg = other.segments[1] ?? other.segments[0];
                deathMeta.set(playerId, {
                  otherId: other.id,
                  otherName: other.name,
                  head,
                  otherSeg,
                  dist: distance(head, otherSeg),
                });
              }
              break; // Already dead, no need to check more
            }
          }
        });

        // Debug: log player death reason to help chase "random" deaths
        if (deadSnakes.has(playerId)) {
          // eslint-disable-next-line no-console
          console.log('[death]', {
            reason: deathReason.get(playerId),
            meta: deathMeta.get(playerId),
            timeRemaining: newTimeRemaining,
          });
        }

        // Apply deaths and kills
        const updatedSnakes = newSnakes.map(snake => {
          if (deadSnakes.has(snake.id)) {
            return { ...snake, isAlive: false };
          }

          // Add kills
          const snakeKills = kills.filter(k => k.killerId === snake.id);
          const pointsGained = snakeKills.reduce((sum, k) => {
            const victim = newSnakes.find(s => s.id === k.victimId);
            return sum + (victim?.score || 0);
          }, 0);

          if (snakeKills.length > 0 || pointsGained > 0) {
            // Activate loot collection for bots that got a kill
            snakeKills.forEach(kill => {
              const botState = botStatesRef.current.get(snake.id);
              const victim = newSnakes.find(s => s.id === kill.victimId);
              if (botState && victim && snake.id.startsWith('bot_')) {
                activateLootCollection(botState, victim.color, victim.segments[0]);
              }
            });
            
            return {
              ...snake,
              kills: snake.kills + snakeKills.length,
              score: snake.score + pointsGained,
            };
          }

          return snake;
        });

        // Spawn food from dead snakes
        let newFood = [...prev.food];
        deadSnakes.forEach(snakeId => {
          const deadSnake = newSnakes.find(s => s.id === snakeId);
          if (deadSnake) {
            // Spawn food at each segment position
            deadSnake.segments.forEach((seg, i) => {
              if (i % 3 === 0) { // Only every 3rd segment to avoid too much food
                newFood.push({
                  id: generateId(),
                  x: seg.x + (Math.random() - 0.5) * 20,
                  y: seg.y + (Math.random() - 0.5) * 20,
                  value: Math.ceil(deadSnake.score / deadSnake.segments.length),
                  color: deadSnake.color,
                });
              }
            });
          }
        });

        // Check food collection
        const collectedFood = new Set<string>();
        const foodCollections: { snakeId: string; value: number }[] = [];

        updatedSnakes.forEach(snake => {
          if (!snake.isAlive) return;

          const head = snake.segments[0];
          newFood.forEach(food => {
            if (collectedFood.has(food.id)) return;
            
            const dist = distance(head, food);
            if (dist < head.radius + 10) {
              collectedFood.add(food.id);
              foodCollections.push({ snakeId: snake.id, value: food.value });
            }
          });
        });

        // Apply food collections and remove collected food
        newFood = newFood.filter(f => !collectedFood.has(f.id));
        
        const finalSnakes = updatedSnakes.map(snake => {
          const collected = foodCollections.filter(fc => fc.snakeId === snake.id);
          if (collected.length > 0) {
            const totalValue = collected.reduce((sum, fc) => sum + fc.value, 0);
            return { ...snake, score: snake.score + totalValue };
          }
          return snake;
        });

        // Spawn new food to maintain count
        while (newFood.length < GAME_CONFIG.FOOD_SPAWN_RATE) {
          newFood.push(createFood());
        }

        return {
          ...prev,
          snakes: finalSnakes,
          food: newFood,
          timeRemaining: newTimeRemaining,
        };
      });

      gameLoopRef.current = requestAnimationFrame(tick);
    };

    gameLoopRef.current = requestAnimationFrame(tick);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState.status, playerId]);

  return {
    gameState,
    updateGameState,
    handlePlayerInput,
    getBoostEnergy,
  };
};
