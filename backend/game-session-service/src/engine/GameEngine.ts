/**
 * Game Engine - Authoritative server-side game engine
 * Handles all game logic, physics, and state updates
 */

import { CollisionDetection } from "./CollisionDetection";
import { GameSettings, GameState, SerializedGameState } from "./GameState";
import { Paddle } from "./Paddle";

export interface GameEngineEvents {
  onScore?: (player: 1 | 2, score1: number, score2: number) => void;
  onGameEnd?: (winner: string, score1: number, score2: number) => void;
  onStateUpdate?: (state: SerializedGameState) => void;
  onCountdown?: (count: number) => void;
}

export class GameEngine {
  private gameState: GameState;
  private events: GameEngineEvents;
  private tickRate: number; // Updates per second
  private updateInterval: NodeJS.Timeout | null = null;
  private lastUpdateTime: number = 0; // For time-based physics
  private aiEnabled: boolean = false;
  private aiDifficulty: "easy" | "medium" | "hard" = "medium";
  private aiReactionDelay: number = 0; // AI can only gather data once per second
  private aiLastUpdateTime: number = 0;
  private aiCachedDirection: "up" | "down" | "stop" = "stop"; // Cache the AI's last decision
  private countdownActive: boolean = false;
  private pausedForScore: boolean = false;
  private scoringInProgress: boolean = false; // Prevent multiple score triggers

  constructor(
    settings: GameSettings,
    events: GameEngineEvents = {},
    tickRate: number = 60
  ) {
    this.gameState = new GameState(settings);
    this.events = events;
    this.tickRate = tickRate;
    this.lastUpdateTime = Date.now();
  }

  private aiErrorMargin: number = 0; // Pixels of intentional error
  private aiPredictionEnabled: boolean = true;

  /**
   * Enable AI opponent for player 2
   */
  private aiMissChance: number = 0; // Probability of completely ignoring the ball (0-1)
  private aiPaddleSpeedMultiplier: number = 1.0; // Reduce paddle speed for easier difficulties

  public enableAI(difficulty: "easy" | "medium" | "hard" = "medium"): void {
    this.aiEnabled = true;
    this.aiDifficulty = difficulty;

    // Store original paddle speed before modification
    const originalSpeed = this.gameState.paddle2.speed;

    // Set accuracy based on difficulty
    switch (difficulty) {
      case "easy":
        this.aiReactionDelay = 300; // 300ms delay - slower reaction
        this.aiErrorMargin = 40; // Misses by up to 60 pixels
        this.aiPredictionEnabled = false; // No prediction, follows current position
        this.aiMissChance = 0; // Always tries to hit
        this.aiPaddleSpeedMultiplier = 0.75; // 75% speed
        break;
      case "medium":
        this.aiReactionDelay = 150; // 150ms delay - moderate reaction
        this.aiErrorMargin = 20; // Misses by up to 30 pixels
        this.aiPredictionEnabled = false; // No prediction for medium
        this.aiMissChance = 0; // Always tries to hit
        this.aiPaddleSpeedMultiplier = 0.9; // 90% speed
        break;
      case "hard":
        this.aiReactionDelay = 100; // 100ms delay - fast reaction
        this.aiErrorMargin = 0; // Small error margin
        this.aiPredictionEnabled = true; // Advanced prediction
        this.aiMissChance = 0; // Never misses
        this.aiPaddleSpeedMultiplier = 1.0; // Full speed
        break;
    }

    // Apply speed multiplier to AI paddle
    this.gameState.paddle2.speed = originalSpeed * this.aiPaddleSpeedMultiplier;

    console.log(
      `🤖 AI enabled: ${difficulty} (reaction delay: ${
        this.aiReactionDelay
      }ms, error: ±${this.aiErrorMargin}px, prediction: ${
        this.aiPredictionEnabled
      }, miss: ${this.aiMissChance * 100}%, speed: ${
        this.aiPaddleSpeedMultiplier * 100
      }%)`
    );
  }

  /**
   * Disable AI opponent
   */
  public disableAI(): void {
    this.aiEnabled = false;
    this.aiCachedDirection = "stop";
    this.aiLastUpdateTime = 0;
    console.log("🤖 AI disabled");
  }

  /**
   * Set player information
   */
  public setPlayer1(id: string, userId: number, username: string): void {
    this.gameState.setPlayer1(id, userId, username);
  }

  public setPlayer2(id: string, userId: number, username: string): void {
    this.gameState.setPlayer2(id, userId, username);
  }

  /**
   * Mark player as ready
   */
  public setPlayerReady(playerId: string): boolean {
    const success = this.gameState.setPlayerReady(playerId);

    // Auto-start if both players ready
    if (success && this.gameState.areBothPlayersReady()) {
      this.start();
    }

    return success;
  }

  /**
   * Start the game loop with time-based physics
   * Includes 3-second countdown before gameplay begins
   */
  public start(): void {
    if (this.updateInterval) {
      return; // Already running
    }

    // Start 3-second countdown
    this.startCountdown();
  }

  /**
   * Start 3-second countdown before gameplay
   */
  private startCountdown(): void {
    this.countdownActive = true;
    let count = 3;

    const countdownInterval = setInterval(() => {
      if (this.events.onCountdown) {
        this.events.onCountdown(count);
      }
      console.log(`⏱️  Countdown: ${count}`);

      count--;

      if (count < 0) {
        clearInterval(countdownInterval);
        this.countdownActive = false;
        if (this.events.onCountdown) {
          this.events.onCountdown(0); // Signal countdown done
        }
        this.actuallyStartGame();
      }
    }, 1000);
  }

  /**
   * Actually start the game after countdown
   */
  private actuallyStartGame(): void {
    this.gameState.start();
    this.lastUpdateTime = Date.now();
    this.scoringInProgress = false; // Reset scoring flag at game start

    // Start update loop at specified tick rate
    this.updateInterval = setInterval(() => {
      this.update();
    }, 1000 / this.tickRate);

    console.log(
      `🎮 Game engine started at ${this.tickRate} FPS (time-based physics)`
    );
  }

  /**
   * Pause the game
   */
  public pause(): void {
    this.gameState.pause();
  }

  /**
   * Resume the game
   */
  public resume(): void {
    this.gameState.resume();
    this.lastUpdateTime = Date.now(); // Reset time tracking
  }

  /**
   * Stop the game loop
   */
  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Main game update loop - Time-based physics system
   *
   * Uses fixed timestep for consistent physics regardless of frame rate
   */
  private update(): void {
    if (this.gameState.status !== "playing" || this.pausedForScore) {
      return;
    }

    // Calculate delta time in seconds
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
    this.lastUpdateTime = currentTime;

    // Cap delta time to prevent huge jumps (e.g., when tab loses focus)
    const cappedDeltaTime = Math.min(deltaTime, 0.1); // Max 100ms

    // Update paddles with time-based movement
    this.gameState.paddle1.update(cappedDeltaTime);
    this.gameState.paddle2.update(cappedDeltaTime);

    // Update ball physics with time delta
    this.gameState.ball.update(
      this.gameState.settings.width,
      this.gameState.settings.height,
      cappedDeltaTime
    );

    // Check paddle collisions
    this.checkPaddleCollisions();

    // Check scoring
    this.checkScoring();

    // Handle AI movement (if enabled)
    if (this.aiEnabled) {
      this.handleAIMovement();
    }

    // Emit state update with ball speed
    if (this.events.onStateUpdate) {
      const state = this.gameState.serialize();
      // Add ball speed to state
      state.ballSpeed = this.gameState.ball.getCurrentSpeed();
      this.events.onStateUpdate(state);
    }
  }

  /**
   * Handle AI paddle movement - AI can only gather data once per second
   */
  private handleAIMovement(): void {
    const currentTime = Date.now();
    const paddle = this.gameState.paddle2;

    // Check if it's time to update AI decision (only once per second)
    if (currentTime - this.aiLastUpdateTime >= this.aiReactionDelay) {
      // Gather data and make a new decision
      const ball = this.gameState.ball;

      // Random chance to completely miss the ball (easier difficulties)
      if (Math.random() < this.aiMissChance) {
        this.aiCachedDirection = "stop"; // AI fails to react
        this.aiLastUpdateTime = currentTime;
        paddle.setInput(this.aiCachedDirection);
        return;
      }

      const paddleCenterY = paddle.y + paddle.height / 2;

      // Calculate target Y position
      let targetY = ball.y;

      // Add prediction for hard difficulty only
      if (this.aiPredictionEnabled && ball.vx > 0) {
        // Ball is moving towards AI paddle - predict future position
        const canvasWidth = this.gameState.settings.width;
        const canvasHeight = this.gameState.settings.height;
        const distanceToAI = canvasWidth - paddle.width - 20 - ball.x;
        const timeToReach = distanceToAI / Math.abs(ball.vx);
        const predictedY = ball.y + ball.vy * timeToReach;

        // Clamp predicted position to canvas bounds
        targetY = Math.max(
          ball.radius,
          Math.min(canvasHeight - ball.radius, predictedY)
        );
      }

      // Add intentional error based on difficulty
      if (this.aiErrorMargin > 0) {
        const error = (Math.random() - 0.5) * this.aiErrorMargin * 2;
        targetY += error;
      }

      // Larger deadzone to reduce jitter and make movement smoother
      const deadzone = 30; // 30 pixels deadzone for smoother movement

      // Make decision and cache it
      if (targetY < paddleCenterY - deadzone) {
        this.aiCachedDirection = "up";
      } else if (targetY > paddleCenterY + deadzone) {
        this.aiCachedDirection = "down";
      } else {
        this.aiCachedDirection = "stop"; // Within acceptable range
      }

      this.aiLastUpdateTime = currentTime;
      console.log(
        `🤖 AI decision updated: ${
          this.aiCachedDirection
        } (targetY: ${targetY.toFixed(1)}, paddleY: ${paddleCenterY.toFixed(
          1
        )})`
      );
    }

    // Apply the cached decision every frame
    paddle.setInput(this.aiCachedDirection);
  }

  /**
   * Check and handle paddle collisions
   */
  private checkPaddleCollisions(): void {
    const ball = this.gameState.ball;
    const paddle1 = this.gameState.paddle1;
    const paddle2 = this.gameState.paddle2;

    // Check left paddle collision
    const leftCollision = CollisionDetection.checkBallPaddleCollision(
      ball,
      paddle1,
      "left"
    );

    if (leftCollision.collided && leftCollision.hitPosition !== undefined) {
      ball.reverseX();
      ball.addSpin(leftCollision.hitPosition);
      // Ensure ball is outside paddle to prevent multiple collisions
      ball.x = paddle1.x + paddle1.width + ball.radius;
    }

    // Check right paddle collision
    const rightCollision = CollisionDetection.checkBallPaddleCollision(
      ball,
      paddle2,
      "right"
    );

    if (rightCollision.collided && rightCollision.hitPosition !== undefined) {
      ball.reverseX();
      ball.addSpin(rightCollision.hitPosition);
      // Ensure ball is outside paddle to prevent multiple collisions
      ball.x = paddle2.x - ball.radius;
    }
  }

  /**
   * Check if ball went out of bounds and handle scoring
   */
  private checkScoring(): void {
    // Prevent multiple score triggers for the same scoring event
    if (this.scoringInProgress) {
      return;
    }

    const outOfBounds = CollisionDetection.checkBallOutOfBounds(
      this.gameState.ball,
      this.gameState.settings.width
    );

    if (outOfBounds === "left") {
      // Player 2 scores
      console.log(
        `⚽ Ball went out left! Player 2 scores. Lock engaged. AI enabled: ${this.aiEnabled}`
      );
      this.scoringInProgress = true; // Lock scoring
      const gameEnded = this.gameState.awardPoint(2);

      if (this.events.onScore) {
        this.events.onScore(
          2,
          this.gameState.player1.score,
          this.gameState.player2.score
        );
      }

      if (gameEnded) {
        this.handleGameEnd();
      } else {
        this.pauseForScore();
      }
    } else if (outOfBounds === "right") {
      // Player 1 scores
      console.log(
        `⚽ Ball went out right! Player 1 scores. Lock engaged. AI enabled: ${this.aiEnabled}`
      );
      this.scoringInProgress = true; // Lock scoring
      const gameEnded = this.gameState.awardPoint(1);

      if (this.events.onScore) {
        this.events.onScore(
          1,
          this.gameState.player1.score,
          this.gameState.player2.score
        );
      }

      if (gameEnded) {
        this.handleGameEnd();
      } else {
        this.pauseForScore();
      }
    }
  }

  /**
   * Pause game and show countdown after scoring, then reset ball and resume
   */
  private pauseForScore(): void {
    this.pausedForScore = true;
    this.gameState.resetForNewPoint();
    console.log("⏸️  Score! Starting countdown...");

    // Start countdown: 3, 2, 1, GO
    let count = 3;
    const countdownInterval = setInterval(() => {
      if (this.events.onCountdown) {
        this.events.onCountdown(count);
      }
      console.log(`⏱️  Countdown: ${count}`);

      count--;

      if (count < 0) {
        clearInterval(countdownInterval);
        if (this.events.onCountdown) {
          this.events.onCountdown(0); // Signal countdown done
        }
        this.pausedForScore = false;
        this.scoringInProgress = false; // Unlock scoring for next point
        this.lastUpdateTime = Date.now(); // Reset time tracking
        console.log("▶️  Resuming game...");
      }
    }, 1000);
  }

  /**
   * Handle game end
   */
  private handleGameEnd(): void {
    this.stop();

    if (this.events.onGameEnd && this.gameState.winner) {
      this.events.onGameEnd(
        this.gameState.winner,
        this.gameState.player1.score,
        this.gameState.player2.score
      );
    }
  }

  /**
   * Handle player input - Sets paddle direction for time-based movement
   */
  public handlePlayerInput(
    playerId: string,
    direction: "up" | "down" | "stop"
  ): void {
    if (this.gameState.status !== "playing") {
      return;
    }

    let paddle: Paddle | null = null;

    if (this.gameState.player1.id === playerId) {
      paddle = this.gameState.paddle1;
    } else if (this.gameState.player2.id === playerId) {
      paddle = this.gameState.paddle2;
    }

    if (!paddle) {
      return;
    }

    // Set paddle input - movement happens in update() with proper deltaTime
    paddle.setInput(direction);
  }

  /**
   * Get current game state
   */
  public getState(): SerializedGameState {
    return this.gameState.serialize();
  }

  /**
   * Get compact game state (for high-frequency updates)
   */
  public getCompactState() {
    return this.gameState.serializeCompact();
  }

  /**
   * Get game status
   */
  public getStatus() {
    return this.gameState.status;
  }

  /**
   * Check if game is finished
   */
  public isFinished(): boolean {
    return this.gameState.isFinished();
  }

  /**
   * Get winner (if game is finished)
   */
  public getWinner(): string | undefined {
    return this.gameState.winner;
  }

  /**
   * Get current scores
   */
  public getScores(): { player1: number; player2: number } {
    return {
      player1: this.gameState.player1.score,
      player2: this.gameState.player2.score,
    };
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stop();
  }
}
