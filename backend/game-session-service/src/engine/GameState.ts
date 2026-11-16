/**
 * Game State Manager
 * Manages the complete state of a game session
 */

import { Ball, BallState } from './Ball';
import { Paddle, PaddleState } from './Paddle';

export type GameStateStatus = 'waiting' | 'countdown' | 'ready' | 'playing' | 'paused' | 'finished';

export interface PlayerState {
  id: string;
  userId: number;
  username: string;
  score: number;
  paddle: PaddleState;
  ready: boolean;
}

export interface GameSettings {
  width: number;
  height: number;
  maxScore: number;
  ballSpeed: number;
  paddleSpeed: number;
  paddleWidth: number;
  paddleHeight: number;
  ballRadius: number;
}

export interface SerializedGameState {
  status: GameStateStatus;
  players: PlayerState[];
  ball: BallState;
  settings: GameSettings;
  countdown?: number;
  winner?: string;
  timestamp: number;
  ballSpeed?: number;
}

export class GameState {
  public status: GameStateStatus;
  public ball: Ball;
  public paddle1: Paddle;
  public paddle2: Paddle;
  public player1: { id: string; userId: number; username: string; score: number; ready: boolean };
  public player2: { id: string; userId: number; username: string; score: number; ready: boolean };
  public settings: GameSettings;
  public countdown: number = 0;
  public winner?: string;
  private lastUpdate: number;

  constructor(settings: GameSettings) {
    this.settings = settings;
    this.status = 'waiting';
    this.lastUpdate = Date.now();

    // Initialize ball at center
    this.ball = new Ball(
      settings.width / 2,
      settings.height / 2,
      settings.ballSpeed,
      settings.ballRadius
    );

    // Initialize paddles
    this.paddle1 = new Paddle(
      20,
      settings.height / 2 - settings.paddleHeight / 2,
      settings.paddleWidth,
      settings.paddleHeight,
      settings.paddleSpeed,
      settings.height
    );

    this.paddle2 = new Paddle(
      settings.width - 20 - settings.paddleWidth,
      settings.height / 2 - settings.paddleHeight / 2,
      settings.paddleWidth,
      settings.paddleHeight,
      settings.paddleSpeed,
      settings.height
    );

    // Initialize players with empty data (will be set later)
    this.player1 = { id: '', userId: 0, username: '', score: 0, ready: false };
    this.player2 = { id: '', userId: 0, username: '', score: 0, ready: false };
  }

  /**
   * Set player 1 info
   */
  public setPlayer1(id: string, userId: number, username: string): void {
    this.player1.id = id;
    this.player1.userId = userId;
    this.player1.username = username;
  }

  /**
   * Set player 2 info
   */
  public setPlayer2(id: string, userId: number, username: string): void {
    this.player2.id = id;
    this.player2.userId = userId;
    this.player2.username = username;
  }

  /**
   * Mark player as ready
   */
  public setPlayerReady(playerId: string): boolean {
    if (this.player1.id === playerId) {
      this.player1.ready = true;
    } else if (this.player2.id === playerId) {
      this.player2.ready = true;
    } else {
      return false;
    }
    return true;
  }

  /**
   * Check if both players are ready
   */
  public areBothPlayersReady(): boolean {
    return this.player1.ready && this.player2.ready && this.status === 'waiting';
  }

  /**
   * Start the game
   */
  public start(): void {
    this.status = 'playing';
    this.ball.resetForNewGame(this.settings.width, this.settings.height);
    this.player1.score = 0;
    this.player2.score = 0;
    this.lastUpdate = Date.now();
  }

  /**
   * Pause the game
   */
  public pause(): void {
    if (this.status === 'playing') {
      this.status = 'paused';
    }
  }

  /**
   * Resume the game
   */
  public resume(): void {
    if (this.status === 'paused') {
      this.status = 'playing';
      this.lastUpdate = Date.now();
    }
  }

  /**
   * Reset for new point
   */
  public resetForNewPoint(): void {
    this.ball.resetForNewPoint(this.settings.width, this.settings.height);
    this.ball.resetRoundTimer();
    
    // Reset paddles to center
    this.paddle1.reset(
      20,
      this.settings.height / 2 - this.settings.paddleHeight / 2
    );
    this.paddle2.reset(
      this.settings.width - 20 - this.settings.paddleWidth,
      this.settings.height / 2 - this.settings.paddleHeight / 2
    );
  }

  /**
   * Award point to a player
   * Returns true if game should end
   */
  public awardPoint(player: 1 | 2): boolean {
    if (player === 1) {
      this.player1.score++;
    } else {
      this.player2.score++;
    }

    // Check for winner
    if (this.player1.score >= this.settings.maxScore) {
      this.status = 'finished';
      this.winner = this.player1.username;
      return true;
    } else if (this.player2.score >= this.settings.maxScore) {
      this.status = 'finished';
      this.winner = this.player2.username;
      return true;
    }

    return false;
  }

  /**
   * Get serialized state for network transmission
   */
  public serialize(): SerializedGameState {
    return {
      status: this.status,
      players: [
        {
          id: this.player1.id,
          userId: this.player1.userId,
          username: this.player1.username,
          score: this.player1.score,
          paddle: this.paddle1.getState(),
          ready: this.player1.ready
        },
        {
          id: this.player2.id,
          userId: this.player2.userId,
          username: this.player2.username,
          score: this.player2.score,
          paddle: this.paddle2.getState(),
          ready: this.player2.ready
        }
      ],
      ball: this.ball.getState(),
      settings: this.settings,
      countdown: this.countdown,
      winner: this.winner,
      timestamp: Date.now()
    };
  }

  /**
   * Get compact state for high-frequency updates (excludes static data)
   */
  public serializeCompact(): {
    ball: BallState;
    paddle1Y: number;
    paddle2Y: number;
    score1: number;
    score2: number;
    status: GameStateStatus;
  } {
    return {
      ball: this.ball.getState(),
      paddle1Y: Math.round(this.paddle1.y * 10) / 10,
      paddle2Y: Math.round(this.paddle2.y * 10) / 10,
      score1: this.player1.score,
      score2: this.player2.score,
      status: this.status
    };
  }

  /**
   * Get time since last update (for delta time calculations)
   */
  public getDeltaTime(): number {
    const now = Date.now();
    const delta = now - this.lastUpdate;
    this.lastUpdate = now;
    return delta;
  }

  /**
   * Check if game is active (playing or paused)
   */
  public isActive(): boolean {
    return this.status === 'playing' || this.status === 'paused';
  }

  /**
   * Check if game is over
   */
  public isFinished(): boolean {
    return this.status === 'finished';
  }
}
