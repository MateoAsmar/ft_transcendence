/**
 * UNIFIED GAME CONSTANTS - Frontend Reference
 * 
 * IMPORTANT: Backend controls actual game physics.
 * These constants MUST match backend exactly for consistent rendering.
 * All speeds are in PIXELS PER SECOND (time-based physics)
 */

export const GAME_CONSTANTS = {
	// Canvas Dimensions - MUST match backend exactly
	CANVAS: {
		WIDTH: 1200,   // Canvas width in pixels
		HEIGHT: 700,   // Canvas height in pixels
	},

	// Paddle Configuration
	PADDLE: {
		WIDTH: 6,              // Paddle width in pixels
		HEIGHT: 80,            // Paddle height in pixels
		SPEED: 500,            // Movement speed in PIXELS PER SECOND
		OFFSET_FROM_EDGE: 20,  // Distance from edges
	},

	// Ball Configuration
	BALL: {
		RADIUS: 8,              // Ball radius in pixels
		BASE_SPEED: 350,        // Initial ball speed in PIXELS PER SECOND
		SPEED_INCREASE: 50,     // Speed increase per interval (px/sec)
		MAX_SPEED: 700,         // Maximum ball speed (px/sec)
		SPEED_INTERVAL: 5000,   // Time between speed increases (milliseconds)
	},

	// Game Rules
	GAME: {
		WINNING_SCORE: 3,          // Points needed to win
		COUNTDOWN_TIME: 3,         // Countdown seconds before start
		COUNTDOWN_INTERVAL: 800,   // Countdown interval in ms
	},

	// Visual Effects
	VISUAL: {
		PADDLE_GLOW: 15,           // Paddle shadow blur intensity
		BALL_GLOW: 20,             // Ball shadow blur intensity
	},

	// Colors (Consistent across all modes)
	COLORS: {
		PLAYER1: '#22d3ee',        // Cyan for player 1
		PLAYER2: '#ec4899',        // Pink for player 2
		BALL: '#ffffff',           // White for ball
		CENTER_LINE: 'rgba(34, 211, 238, 0.3)',  // Cyan transparent
	}
} as const;

// Legacy exports for backwards compatibility
export const CANVAS_WIDTH = GAME_CONSTANTS.CANVAS.WIDTH;
export const CANVAS_HEIGHT = GAME_CONSTANTS.CANVAS.HEIGHT;

// Type export for TypeScript
export type GameConstants = typeof GAME_CONSTANTS;
