/**
 * Intelligent Bot AI for Slither.io-style game
 * 
 * Priority System:
 * 1. SURVIVAL - Wall avoidance + Snake collision avoidance
 * 2. FOOD - Intelligent food seeking (not greedy)
 * 3. MOVEMENT - Natural wandering with curves
 */

import { SerializedSnake, Food, GAME_CONFIG, Point } from './gameTypes';
import { distance, angleBetween, normalizeAngle } from './gameUtils';

// Bot personality - makes each bot unique and beatable
export interface BotPersonality {
  reactionSpeed: number;      // 0.3-0.9: How fast bot reacts to danger
  dangerLookAhead: number;    // 100-300: How far bot looks ahead for walls
  hungerLevel: number;        // 0.3-0.9: How often bot actively seeks food
  curviness: number;          // 0.1-0.5: How much bot curves while wandering
  boostFrequency: number;     // 0.02-0.15: How often bot boosts randomly
  aggression: number;         // 0.1-0.5: How close bot gets to other snakes
}

// Persistent state per bot
export interface BotState {
  personality: BotPersonality;
  wanderPhase: number;           // 0 to 2*PI, slowly increases for smooth curves
  lastBoostTime: number;         // Timestamp of last boost
  currentFoodTarget: string | null;  // ID of food being pursued
  foodTargetAge: number;         // How long chasing current food
  lastDirectionChange: number;   // Timestamp of last random direction change
  pauseEating: boolean;          // Temporarily ignore food
  pauseEatingUntil: number;      // When to resume eating
  // Hunting state
  huntTarget: string | null;     // ID of snake being hunted
  huntStartTime: number;         // When hunt started
  lastHuntAttempt: number;       // Cooldown for hunting
  // Loot collection state (after kill)
  collectingLoot: boolean;       // Whether bot is collecting loot
  lootTargetColor: string | null; // Color of loot to collect (victim's color)
  lootCollectionStart: number;   // When loot collection started
  lootPosition: Point | null;    // Position where victim died
}

// Result of bot AI calculation
export interface BotMoveResult {
  targetAngle: number;
  shouldBoost: boolean;
  behavior: 'wall_avoid' | 'snake_avoid' | 'hunt' | 'loot' | 'eat' | 'wander';
}

// Generate random personality for a bot
export function createBotPersonality(): BotPersonality {
  return {
    reactionSpeed: 0.32 + Math.random() * 0.64,    // 0.32-0.96 (+7%)
    dangerLookAhead: 107 + Math.random() * 214,    // 107-321px (+7%)
    hungerLevel: 0.65 + Math.random() * 0.3,       // 0.65-0.95 (higher = more food focused, slightly faster eating)
    curviness: 0.02 + Math.random() * 0.08,        // 0.02-0.1 (much lower = less spinning)
    boostFrequency: 0.02 + Math.random() * 0.13,   // 0.02-0.15
    aggression: 0.1 + Math.random() * 0.4,         // 0.1-0.5
  };
}

// Create initial bot state
export function createBotState(): BotState {
  return {
    personality: createBotPersonality(),
    wanderPhase: Math.random() * Math.PI * 2,
    lastBoostTime: 0,
    currentFoodTarget: null,
    foodTargetAge: 0,
    lastDirectionChange: Date.now(),
    pauseEating: false,
    pauseEatingUntil: 0,
    huntTarget: null,
    huntStartTime: 0,
    lastHuntAttempt: 0,
    collectingLoot: false,
    lootTargetColor: null,
    lootCollectionStart: 0,
    lootPosition: null,
  };
}

// Activate loot collection mode for a bot after a kill
export function activateLootCollection(
  botState: BotState,
  victimColor: string,
  victimPosition: Point
): void {
  botState.collectingLoot = true;
  botState.lootTargetColor = victimColor;
  botState.lootCollectionStart = Date.now();
  botState.lootPosition = victimPosition;
  botState.huntTarget = null; // Stop hunting, focus on loot
}

// Find loot food (food dropped by killed enemy)
function findLootFood(
  bot: SerializedSnake,
  food: Food[],
  botState: BotState
): Food | null {
  if (!botState.lootTargetColor || !botState.lootPosition) return null;
  
  const head = bot.segments[0];
  const searchRadius = 400; // Search within 400px of kill location
  
  let bestLoot: Food | null = null;
  let bestScore = -Infinity;
  
  for (const f of food) {
    // Only consider food with victim's color
    if (f.color !== botState.lootTargetColor) continue;
    
    const distToBot = distance(head, f);
    const distToLootArea = distance(botState.lootPosition, f);
    
    // Must be within search radius of original kill position
    if (distToLootArea > searchRadius) continue;
    
    // Prioritize closest food to bot
    const score = 1000 / (distToBot + 50);
    
    if (score > bestScore) {
      bestScore = score;
      bestLoot = f;
    }
  }
  
  return bestLoot;
}

// Calculate distance to nearest wall in a given direction
function distanceToWall(pos: Point, direction: number): number {
  const cosD = Math.cos(direction);
  const sinD = Math.sin(direction);
  
  let minDist = Infinity;
  
  // Distance to right wall
  if (cosD > 0.01) {
    minDist = Math.min(minDist, (GAME_CONFIG.MAP_WIDTH - pos.x) / cosD);
  }
  // Distance to left wall
  if (cosD < -0.01) {
    minDist = Math.min(minDist, -pos.x / cosD);
  }
  // Distance to bottom wall
  if (sinD > 0.01) {
    minDist = Math.min(minDist, (GAME_CONFIG.MAP_HEIGHT - pos.y) / sinD);
  }
  // Distance to top wall
  if (sinD < -0.01) {
    minDist = Math.min(minDist, -pos.y / sinD);
  }
  
  return Math.max(0, minDist);
}

// Check if a point is in the "safe zone" (away from walls)
function isInSafeZone(pos: Point, margin: number = 200): boolean {
  return pos.x > margin && 
         pos.x < GAME_CONFIG.MAP_WIDTH - margin &&
         pos.y > margin && 
         pos.y < GAME_CONFIG.MAP_HEIGHT - margin;
}

// Calculate angle to steer away from walls
function getWallAvoidanceAngle(pos: Point, currentDirection: number, lookAhead: number): number | null {
  const wallDist = distanceToWall(pos, currentDirection);
  
  if (wallDist > lookAhead) {
    return null; // No wall danger
  }
  
  // Wall is close - calculate escape angle
  const urgency = 1 - (wallDist / lookAhead); // 0 to 1, higher = closer to wall
  
  // Find the best escape direction by checking multiple angles
  let bestAngle = currentDirection;
  let bestScore = -Infinity;
  
  // Check 8 directions
  for (let i = 0; i < 8; i++) {
    const testAngle = currentDirection + (i - 4) * 0.4; // -1.6 to +1.2 radians
    const testDist = distanceToWall(pos, testAngle);
    
    // Prefer directions that lead away from walls AND toward center
    const centerX = GAME_CONFIG.MAP_WIDTH / 2;
    const centerY = GAME_CONFIG.MAP_HEIGHT / 2;
    const toCenterAngle = angleBetween(pos, { x: centerX, y: centerY });
    const angleDiffToCenter = Math.abs(normalizeAngle(testAngle - toCenterAngle));
    const centerBonus = 1 - (angleDiffToCenter / Math.PI); // 0 to 1
    
    const score = testDist + centerBonus * 100;
    
    if (score > bestScore) {
      bestScore = score;
      bestAngle = testAngle;
    }
  }
  
  // Blend current direction with escape angle based on urgency
  const blendFactor = Math.min(1, urgency * 2); // More urgent = faster turn
  return currentDirection + normalizeAngle(bestAngle - currentDirection) * blendFactor;
}

// Check for nearby snake segments and calculate avoidance
// OPTIMIZATION: Check only every 4th segment + early-exit when danger found
function getSnakeAvoidanceAngle(
  bot: SerializedSnake,
  allSnakes: SerializedSnake[],
  personality: BotPersonality
): { angle: number; danger: number; isAttacking: boolean } | null {
  const head = bot.segments[0];
  const lookDistance = personality.dangerLookAhead * 1.5;
  const fov = Math.PI; // 180 degree field of view
  
  let dangerVectorX = 0;
  let dangerVectorY = 0;
  let totalDanger = 0;
  let nearestPlayerHead: Point | null = null;
  let nearestPlayerDist = Infinity;
  
  for (const snake of allSnakes) {
    if (!snake.isAlive) continue;
    
    // Track player snake heads for potential attack
    if (!snake.id.startsWith('bot_') && snake.id !== bot.id) {
      const playerHead = snake.segments[0];
      const distToPlayer = distance(head, playerHead);
      if (distToPlayer < nearestPlayerDist && distToPlayer < 300) {
        nearestPlayerDist = distToPlayer;
        nearestPlayerHead = playerHead;
      }
    }
    
    // Check segments (skip own head and neck)
    const startIdx = snake.id === bot.id ? 15 : 0;
    
    // OPTIMIZATION: Check only every 4th segment (75% reduction)
    const step = 4;
    for (let i = startIdx; i < snake.segments.length; i += step) {
      const seg = snake.segments[i];
      const dist = distance(head, seg);
      
      if (dist > lookDistance) continue;
      
      // Check if segment is in front of bot (within FOV)
      const angleToSeg = angleBetween(head, seg);
      const angleDiff = Math.abs(normalizeAngle(angleToSeg - bot.direction));
      
      if (angleDiff > fov / 2) continue; // Outside field of view
      
      // Calculate danger contribution (closer = more dangerous)
      const danger = 1 - (dist / lookDistance);
      const weight = danger * danger; // Quadratic falloff
      
      // Add to danger vector (pointing AWAY from segment)
      const awayAngle = angleBetween(seg, head);
      dangerVectorX += Math.cos(awayAngle) * weight;
      dangerVectorY += Math.sin(awayAngle) * weight;
      totalDanger += weight;
      
      // OPTIMIZATION: Early exit when enough danger detected
      if (totalDanger > 1.5) {
        break;
      }
    }
    
    // Early exit from outer loop too
    if (totalDanger > 1.5) break;
  }
  
  // 2% chance to attack player instead of avoiding (based on aggression)
  const attackChance = personality.aggression * 0.05; // 0.5% to 2.5% chance
  if (nearestPlayerHead && Math.random() < attackChance && nearestPlayerDist > 80) {
    // Attack mode! Move TOWARD player's path
    const attackAngle = angleBetween(head, nearestPlayerHead);
    return { angle: attackAngle, danger: 0.5, isAttacking: true };
  }
  
  if (totalDanger < 0.1) {
    return null; // No significant danger
  }
  
  // Calculate escape angle from danger vector
  const escapeAngle = Math.atan2(dangerVectorY, dangerVectorX);
  
  // Delayed reaction based on personality (slower bots are easier to catch)
  const reactionMultiplier = personality.reactionSpeed;
  const blendedAngle = bot.direction + normalizeAngle(escapeAngle - bot.direction) * reactionMultiplier;
  
  return { angle: blendedAngle, danger: Math.min(1, totalDanger), isAttacking: false };
}

// Find best food to pursue
// OPTIMIZATION: Limit to 50 food items
function findBestFood(
  bot: SerializedSnake,
  food: Food[],
  allSnakes: SerializedSnake[],
  botState: BotState
): Food | null {
  const head = bot.segments[0];
  const searchRadius = 700; // Slightly larger search radius for faster food collection
  
  let bestFood: Food | null = null;
  let bestScore = -Infinity;
  let checkedCount = 0;
  
  // If we have a current target, give it a bonus to prevent switching
  const currentTarget = botState.currentFoodTarget;
  
  for (const f of food) {
    // OPTIMIZATION: Only check first 50 food items
    if (checkedCount++ > 50) break;
    
    const dist = distance(head, f);
    if (dist > searchRadius) continue;
    
    // Base score: value / distance
    let score = (f.value * 10) / (dist + 50);
    
    // Bonus for current target (prevents jittery behavior)
    if (currentTarget === f.id) {
      score *= 1.5;
    }
    
    // Penalty for food near walls
    if (!isInSafeZone({ x: f.x, y: f.y }, 100)) {
      score *= 0.5;
    }
    
    // OPTIMIZATION: Skip snake proximity check (costly)
    // Only check 3 snakes for contested food
    let contestedPenalty = 1;
    let snakeChecked = 0;
    for (const snake of allSnakes) {
      if (snake.id === bot.id || !snake.isAlive) continue;
      if (snakeChecked++ > 3) break;
      const otherHead = snake.segments[0];
      const distToOther = distance(f, otherHead);
      if (distToOther < 100) {
        contestedPenalty = 0.3;
        break;
      }
    }
    score *= contestedPenalty;
    
    if (score > bestScore) {
      bestScore = score;
      bestFood = f;
    }
  }
  
  return bestFood;
}

// Find a suitable hunt target (smaller snake to chase)
// OPTIMIZATION: Limit search to first 10 candidates
function findHuntTarget(
  bot: SerializedSnake,
  allSnakes: SerializedSnake[],
  personality: BotPersonality
): SerializedSnake | null {
  // Lower threshold: hunt if score > 15 (was 40)
  if (bot.score < 15) return null;
  
  const head = bot.segments[0];
  let bestTarget: SerializedSnake | null = null;
  let bestScore = 0;
  let checkedCount = 0;
  
  for (const other of allSnakes) {
    if (other.id === bot.id || !other.isAlive) continue;
    
    // OPTIMIZATION: Only check first 10 candidates
    if (checkedCount++ > 10) break;
    
    const isPlayer = !other.id.startsWith('bot_');
    
    // For players: only hunt if bot is much bigger (2x score) and rarely
    if (isPlayer) {
      if (bot.score < other.score * 2) continue;
      // Only 20% of the time consider player as target
      if (Math.random() > 0.2) continue;
    } else {
      // For bots: hunt if at least 10% smaller (was 20%)
      if (other.score > bot.score * 0.9) continue;
    }
    
    // Must have at least some score to be worth hunting
    if (other.score < 5) continue;
    
    const otherHead = other.segments[0];
    const dist = distance(head, otherHead);
    
    // Larger hunt range: < 500px (was 450)
    if (dist > 500) continue;
    
    // Don't hunt near walls
    if (!isInSafeZone(otherHead, 150)) continue;
    
    // Score: bigger prey + closer = better target
    // Players are worth more (incentivize hunting players occasionally)
    const playerBonus = isPlayer ? 1.5 : 1;
    const score = (other.score * playerBonus) / (dist + 100);
    
    if (score > bestScore) {
      bestScore = score;
      bestTarget = other;
    }
  }
  
  return bestTarget;
}

// Calculate angle to intercept prey - AGGRESSIVE: direct attack when close
function calculateHuntAngle(
  hunter: SerializedSnake,
  prey: SerializedSnake
): number {
  const hunterHead = hunter.segments[0];
  const preyHead = prey.segments[0];
  const dist = distance(hunterHead, preyHead);
  
  // AGGRESSIVE: When close (< 150px), aim directly at prey's head
  if (dist < 150) {
    return angleBetween(hunterHead, preyHead);
  }
  
  // Medium distance: predict and intercept
  const preySpeed = prey.isBoosting ? GAME_CONFIG.BOOST_SPEED : GAME_CONFIG.BASE_SPEED;
  const predictTime = 0.5;
  const predictDistance = preySpeed * 60 * predictTime;
  
  const predictedX = preyHead.x + Math.cos(prey.direction) * predictDistance;
  const predictedY = preyHead.y + Math.sin(prey.direction) * predictDistance;
  
  return angleBetween(hunterHead, { x: predictedX, y: predictedY });
}

// Calculate natural wandering movement
function getWanderAngle(bot: SerializedSnake, botState: BotState): number {
  const { personality } = botState;
  
  // Very subtle sine-based wandering - mostly straight with tiny curves
  const wanderOffset = Math.sin(botState.wanderPhase) * personality.curviness;
  
  // Occasional random direction changes (less frequent, smaller angle)
  const now = Date.now();
  let randomOffset = 0;
  if (now - botState.lastDirectionChange > 5000 + Math.random() * 5000) {
    // Smaller random turn (0.3-0.6 radians instead of 1.0)
    randomOffset = (Math.random() - 0.5) * 0.5;
    botState.lastDirectionChange = now;
  }
  
  return bot.direction + wanderOffset + randomOffset;
}

// Main bot AI function
export function calculateBotMove(
  bot: SerializedSnake,
  allSnakes: SerializedSnake[],
  food: Food[],
  botState: BotState,
  boostEnergy: number
): BotMoveResult {
  const { personality } = botState;
  const head = bot.segments[0];
  const now = Date.now();
  
  // Update wander phase for smooth movement (slower = less spinning)
  botState.wanderPhase += 0.005;
  if (botState.wanderPhase > Math.PI * 2) {
    botState.wanderPhase -= Math.PI * 2;
  }
  
  let targetAngle = bot.direction;
  let shouldBoost = false;
  let behavior: BotMoveResult['behavior'] = 'wander';
  
  // PRIORITY 1: Wall avoidance
  const wallAngle = getWallAvoidanceAngle(head, bot.direction, personality.dangerLookAhead);
  if (wallAngle !== null) {
    targetAngle = wallAngle;
    behavior = 'wall_avoid';
    
    // Boost to escape wall if very close
    const wallDist = distanceToWall(head, bot.direction);
    if (wallDist < 50 && boostEnergy > 40) {
      shouldBoost = true;
    }
  }
  
  // PRIORITY 2: Snake avoidance (only if not already avoiding wall)
  if (behavior !== 'wall_avoid') {
    const snakeAvoid = getSnakeAvoidanceAngle(bot, allSnakes, personality);
    if (snakeAvoid !== null && snakeAvoid.danger > 0.3) {
      targetAngle = snakeAvoid.angle;
      behavior = 'snake_avoid';
      
      // Boost to escape if danger is high
      if (snakeAvoid.danger > 0.7 && boostEnergy > 60 && now - botState.lastBoostTime > 3000) {
        shouldBoost = true;
        botState.lastBoostTime = now;
      }
    }
  }
  
  // PRIORITY 3: Hunting (only if no danger and big enough)
  if (behavior === 'wander') {
    // Evaluate new hunt targets every 1.5 seconds (was 3s)
    if (now - botState.lastHuntAttempt > 1500) {
      botState.lastHuntAttempt = now;
      
      // Much higher chance to hunt: aggression * 2.5 + 0.3 (55-100% chance)
      if (Math.random() < personality.aggression * 2.5 + 0.3) {
        const target = findHuntTarget(bot, allSnakes, personality);
        if (target) {
          botState.huntTarget = target.id;
          botState.huntStartTime = now;
        }
      }
    }
    
    // Execute active hunt
    if (botState.huntTarget) {
      const prey = allSnakes.find(s => s.id === botState.huntTarget && s.isAlive);
      
      if (prey) {
        const dist = distance(head, prey.segments[0]);
        const huntDuration = now - botState.huntStartTime;
        
        // Abort hunt if (more lenient now):
        // - Prey too far (> 600px, was 500)
        // - Hunt too long (> 15 seconds, was 10)
        // - Prey is now bigger than us (> 95%, was 80%)
        if (dist > 600 || huntDuration > 15000 || prey.score > bot.score * 0.95) {
          botState.huntTarget = null;
        } else {
          // HUNT!
          targetAngle = calculateHuntAngle(bot, prey);
          behavior = 'hunt';
          
          // Boost when hunting and close (more aggressive)
          if (dist < 250 && boostEnergy > 40 && now - botState.lastBoostTime > 1500) {
            shouldBoost = true;
            botState.lastBoostTime = now;
          }
        }
      } else {
        // Prey dead or gone
        botState.huntTarget = null;
      }
    }
  }
  
  // PRIORITY 3.5: Loot collection (after a kill)
  if (behavior === 'wander' && botState.collectingLoot) {
    const lootDuration = now - botState.lootCollectionStart;
    
    // Stop collecting after 5 seconds
    if (lootDuration > 5000) {
      botState.collectingLoot = false;
      botState.lootTargetColor = null;
      botState.lootPosition = null;
    } else {
      const lootFood = findLootFood(bot, food, botState);
      
      if (lootFood) {
        targetAngle = angleBetween(head, lootFood);
        behavior = 'loot';
        
        // Boost to collect loot quickly
        const distToLoot = distance(head, lootFood);
        if (distToLoot < 200 && boostEnergy > 30 && now - botState.lastBoostTime > 1000) {
          shouldBoost = true;
          botState.lastBoostTime = now;
        }
      } else {
        // No more loot to collect, stop
        botState.collectingLoot = false;
        botState.lootTargetColor = null;
        botState.lootPosition = null;
      }
    }
  }
  
  // PRIORITY 4: Food seeking (only if no danger and not hunting)
  if (behavior === 'wander') {
    // Check if bot should pause eating (rate limiting)
    if (now > botState.pauseEatingUntil) {
      botState.pauseEating = Math.random() > personality.hungerLevel;
      if (botState.pauseEating) {
        botState.pauseEatingUntil = now + 1000 + Math.random() * 2000; // Pause 1-3 seconds
      }
    }
    
    if (!botState.pauseEating) {
      // 70% chance to keep current target, 30% to re-evaluate
      const shouldReevaluate = botState.currentFoodTarget === null || 
                               Math.random() > 0.7 || 
                               botState.foodTargetAge > 180; // ~3 seconds at 60fps
      
      if (shouldReevaluate) {
        const bestFood = findBestFood(bot, food, allSnakes, botState);
        if (bestFood) {
          botState.currentFoodTarget = bestFood.id;
          botState.foodTargetAge = 0;
        } else {
          botState.currentFoodTarget = null;
        }
      }
      
      // Pursue current target
      if (botState.currentFoodTarget) {
        const targetFood = food.find(f => f.id === botState.currentFoodTarget);
        if (targetFood) {
          targetAngle = angleBetween(head, targetFood);
          behavior = 'eat';
          botState.foodTargetAge++;
          
          // Boost for high-value food nearby
          const distToFood = distance(head, targetFood);
          if (targetFood.value >= 5 && distToFood < 150 && boostEnergy > 60 && now - botState.lastBoostTime > 3000) {
            shouldBoost = true;
            botState.lastBoostTime = now;
          }
        } else {
          // Food was eaten, clear target
          botState.currentFoodTarget = null;
          botState.foodTargetAge = 0;
        }
      }
    }
  }
  
  // PRIORITY 4: Natural wandering (fallback)
  if (behavior === 'wander') {
    targetAngle = getWanderAngle(bot, botState);
    
    // Random occasional boost
    if (Math.random() < personality.boostFrequency * 0.01 && boostEnergy > 70 && now - botState.lastBoostTime > 5000) {
      shouldBoost = true;
      botState.lastBoostTime = now;
    }
  }
  
  // Safety check: if heading toward wall while wandering, steer toward center
  if (behavior === 'wander' && !isInSafeZone(head, 300)) {
    const centerX = GAME_CONFIG.MAP_WIDTH / 2;
    const centerY = GAME_CONFIG.MAP_HEIGHT / 2;
    const toCenterAngle = angleBetween(head, { x: centerX, y: centerY });
    targetAngle = bot.direction + normalizeAngle(toCenterAngle - bot.direction) * 0.3;
  }
  
  return { targetAngle, shouldBoost, behavior };
}
