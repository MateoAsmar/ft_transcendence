/**
 * UNIFIED GAME CONSTANTS - SINGLE SOURCE OF TRUTH
 * 
 * These constants define ALL game physics and dimensions
 * Used by both backend game engine and frontend rendering
 * 
 * CRITICAL: All speeds are in PIXELS PER SECOND (not per frame!)
 * This ensures consistent physics regardless of frame rate
 */

export const GAME_CONSTANTS = {
  // Canvas Dimensions - MUST match frontend canvas exactly
  CANVAS: {
    WIDTH: 1200,   // Canvas width in pixels
    HEIGHT: 700,   // Canvas height in pixels
  },

  // Paddle Configuration
  PADDLE: {
    WIDTH: 6,              // Paddle width in pixels
    HEIGHT: 80,            // Paddle height in pixels
    SPEED: 500,            // Movement speed in PIXELS PER SECOND
    OFFSET_FROM_EDGE: 20,  // Distance from left/right edge
  },

  // Ball Configuration
  BALL: {
    RADIUS: 8,              // Ball radius in pixels
    INITIAL_SPEED: 350,     // Starting speed in PIXELS PER SECOND
    SPEED_INCREASE: 50,     // Speed increase per interval (px/sec)
    MAX_SPEED: 700,         // Maximum speed (px/sec)
    SPEED_INTERVAL: 5000,   // Time between speed increases (milliseconds)
  },

  // Physics Engine
  PHYSICS: {
    TICK_RATE: 60,              // Server updates per second
    FIXED_TIMESTEP: 1000 / 60,  // Fixed timestep in milliseconds (16.67ms)
  },

  // Game Rules
  RULES: {
    WINNING_SCORE: 3,      // Points needed to win
    COUNTDOWN_DURATION: 3, // Countdown seconds before game starts
  },

  // AI Configuration
  AI: {
    REACTION_DELAY: {
      EASY: 200,    // 200ms reaction time
      MEDIUM: 100,  // 100ms reaction time
      HARD: 50,     // 50ms reaction time
    },
  },

  // Legacy compatibility (deprecated - use nested objects above)
  PADDLE_WIDTH: 6,
  PADDLE_HEIGHT: 80,
  PADDLE_SPEED: 500,
  BALL_RADIUS: 8,
  BALL_BASE_SPEED: 350,
  BALL_SPEED_INCREMENT: 50,
  BALL_MAX_SPEED: 700,
  BALL_SPEED_INTERVAL: 5000,
  SCORE_TO_WIN: 3,
  COUNTDOWN_TIME: 3,
  COUNTDOWN_INTERVAL: 800,
  FIELD_WIDTH: 1200,
  FIELD_HEIGHT: 700,
} as const;

// Type exports
export type GameConstants = typeof GAME_CONSTANTS;
