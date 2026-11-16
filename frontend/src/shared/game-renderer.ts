/**
 * Game Renderer - Frontend canvas rendering only (no game logic)
 * Receives game state from backend and renders it
 */

import { GAME_CONSTANTS } from '../pages/game/game-constants';
import { ScoreboardController } from './scoreboard';

export interface RenderState {
  ball: {
    x: number;
    y: number;
    radius: number;
  };
  paddle1: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  paddle2: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  score1: number;
  score2: number;
  player1Name?: string;
  player2Name?: string;
}

export interface CountdownState {
  active: boolean;
  count: number;
}

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderLoop: number = 0;
  private currentState: RenderState | null = null;
  private countdownState: CountdownState = { active: false, count: 0 };
  private countdownBanner: HTMLElement | null = null;
  
  // Client-side interpolation for smooth rendering
  private lastState: RenderState | null = null;
  private nextState: RenderState | null = null;
  private interpolationAlpha: number = 0;
  
  // Scoreboard controller
  private scoreboard: ScoreboardController;
  
  // Store resize handler for cleanup
  private resizeHandler: () => void;

  constructor(canvasId: string = 'gameCanvas') {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error(`Canvas element '${canvasId}' not found`);
    }
    
    this.ctx = this.canvas.getContext('2d')!;
    if (!this.ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }

    this.resizeHandler = () => {};
    this.setupCanvas();
    
    // Initialize scoreboard controller
    this.scoreboard = new ScoreboardController();
  }

  /**
   * Setup canvas with proper resolution and responsive sizing
   */
  private setupCanvas(): void {
    // Set internal resolution
    const attrWidth = parseInt(this.canvas.getAttribute('width') || '1200', 10);
    const attrHeight = parseInt(this.canvas.getAttribute('height') || '700', 10);
    
    this.canvas.width = attrWidth;
    this.canvas.height = attrHeight;

    // Make canvas responsive
    this.setupResponsiveCanvas();
  }

  /**
   * Setup responsive canvas sizing
   */
  private setupResponsiveCanvas(): void {
    this.resizeHandler = () => {
      const container = this.canvas.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const aspectRatio = 1200 / 700;

      let canvasWidth = Math.min(containerRect.width - 20, 1200);
      let canvasHeight = canvasWidth / aspectRatio;

      // Ensure canvas fits in viewport height
      const maxHeight = window.innerHeight - 250;
      if (canvasHeight > maxHeight) {
        canvasHeight = maxHeight;
        canvasWidth = canvasHeight * aspectRatio;
      }

      // Update canvas display size (CSS)
      this.canvas.style.width = canvasWidth + 'px';
      this.canvas.style.height = canvasHeight + 'px';
    };

    this.resizeHandler();
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('orientationchange', () => {
      setTimeout(this.resizeHandler, 100);
    });
  }

  /**
   * Update game state to render
   * This is called when new state arrives from the server
   */
  public updateState(state: RenderState): void {
    console.log('🎨 updateState called - ball:', state.ball.x.toFixed(0), state.ball.y.toFixed(0));
    this.lastState = this.currentState;
    this.nextState = state;
    this.currentState = state;
    this.interpolationAlpha = 0;
  }

  /**
   * Update countdown state
   */
  public updateCountdown(count: number): void {
    this.countdownState = { active: true, count };
    this.syncCountdownBanner();
  }

  /**
   * Clear countdown
   */
  public clearCountdown(): void {
    this.countdownState = { active: false, count: 0 };
    this.syncCountdownBanner();
  }

  /**
   * Start rendering loop
   */
  public startRendering(): void {
    // Always stop any existing loop first to ensure clean state
    this.stopRendering();

    const render = () => {
      this.render();
      this.renderLoop = requestAnimationFrame(render);
    };

    this.renderLoop = requestAnimationFrame(render);
    console.log('🎨 Rendering loop started');
  }

  /**
   * Stop rendering loop
   */
  public stopRendering(): void {
    if (this.renderLoop !== 0) {
      cancelAnimationFrame(this.renderLoop);
      this.renderLoop = 0;
      console.log('🛑 Rendering loop stopped');
    }
  }

  /**
   * Main render function
   */
  private render(): void {
    // Clear canvas
    this.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw center line
    this.drawCenterLine();

    // Draw game objects if state exists
    if (this.currentState) {
      // Interpolate between states for smooth rendering
      const state = this.getInterpolatedState();
      
      this.drawPaddle(state.paddle1, GAME_CONSTANTS.COLORS.PLAYER1);
      this.drawPaddle(state.paddle2, GAME_CONSTANTS.COLORS.PLAYER2);
      this.drawBall(state.ball);
    } else {
      console.warn('⚠️ render() called but currentState is null!');
    }

    // Draw countdown if active
    if (this.countdownState.active && this.countdownState.count > 0 && !this.countdownBanner) {
      this.drawCountdown();
    }
  }

  /**
   * Interpolate between last and next state for smooth rendering
   */
  private getInterpolatedState(): RenderState {
    if (!this.lastState || !this.nextState || this.interpolationAlpha >= 1) {
      return this.currentState!;
    }

    // Simple linear interpolation
    const alpha = Math.min(1, this.interpolationAlpha);
    this.interpolationAlpha += 0.1; // Adjust for smoother/faster interpolation

    return {
      ball: {
        x: this.lerp(this.lastState.ball.x, this.nextState.ball.x, alpha),
        y: this.lerp(this.lastState.ball.y, this.nextState.ball.y, alpha),
        radius: this.nextState.ball.radius
      },
      paddle1: {
        x: this.nextState.paddle1.x,
        y: this.lerp(this.lastState.paddle1.y, this.nextState.paddle1.y, alpha),
        width: this.nextState.paddle1.width,
        height: this.nextState.paddle1.height
      },
      paddle2: {
        x: this.nextState.paddle2.x,
        y: this.lerp(this.lastState.paddle2.y, this.nextState.paddle2.y, alpha),
        width: this.nextState.paddle2.width,
        height: this.nextState.paddle2.height
      },
      score1: this.nextState.score1,
      score2: this.nextState.score2,
      player1Name: this.nextState.player1Name,
      player2Name: this.nextState.player2Name
    };
  }

  /**
   * Linear interpolation
   */
  private lerp(start: number, end: number, alpha: number): number {
    return start + (end - start) * alpha;
  }

  /**
   * Draw center line
   */
  private drawCenterLine(): void {
    this.ctx.strokeStyle = GAME_CONSTANTS.COLORS.CENTER_LINE;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([10, 10]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width / 2, 0);
    this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  /**
   * Draw paddle
   */
  private drawPaddle(paddle: { x: number; y: number; width: number; height: number }, color: string): void {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = GAME_CONSTANTS.VISUAL.PADDLE_GLOW;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    this.ctx.shadowBlur = 0;
  }

  /**
   * Draw ball
   */
  private drawBall(ball: { x: number; y: number; radius: number }): void {
    this.ctx.shadowColor = GAME_CONSTANTS.COLORS.BALL;
    this.ctx.shadowBlur = GAME_CONSTANTS.VISUAL.BALL_GLOW;
    this.ctx.fillStyle = GAME_CONSTANTS.COLORS.BALL;
    this.ctx.beginPath();
    this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
  }

  /**
   * Draw countdown
   */
  private drawCountdown(): void {
    const messages = ['', 'GO!', 'SET', 'READY'];
    const colors = ['', '#10b981', '#f59e0b', '#ef4444'];
    const message = messages[this.countdownState.count] || this.countdownState.count.toString();
    const color = colors[this.countdownState.count] || '#22d3ee';

    // Create pulsing effect
    const time = Date.now() % 1000;
    const scale = 1 + Math.sin((time / 1000) * Math.PI * 2) * 0.1;

    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = color;
    this.ctx.fillStyle = color;
    this.ctx.font = `bold ${Math.floor(60 * scale)}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(message, this.canvas.width / 2, 80);
    this.ctx.shadowBlur = 0;
  }

  /**
   * Draw game over screen
   */
  public drawGameOver(winner: string, score1: number, score2: number): void {
    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Winner text
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#22d3ee';
    this.ctx.fillStyle = '#22d3ee';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${winner} Wins!`, this.canvas.width / 2, this.canvas.height / 2 - 40);

    // Final score
    this.ctx.font = 'bold 32px Arial';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(
      `Final Score: ${score1} - ${score2}`,
      this.canvas.width / 2,
      this.canvas.height / 2 + 20
    );
    this.ctx.shadowBlur = 0;
  }

  /**
   * Update score display in DOM
   */
  public updateScoreDisplay(score1: number, score2: number, maxScore: number = 3): void {
    this.scoreboard.updateScores(score1, score2, maxScore);
  }

  /**
   * Update player names in DOM
   */
  public updatePlayerNames(player1Name: string, player2Name: string): void {
    this.scoreboard.updatePlayerNames(player1Name, player2Name);
  }
  
  /**
   * Update game timer
   */
  public updateTimer(seconds: number): void {
    this.scoreboard.updateTimer(seconds);
  }
  
  /**
   * Highlight winner on scoreboard
   */
  public highlightWinner(winner: 1 | 2): void {
    this.scoreboard.highlightWinner(winner);
  }

  /**
   * Clear canvas
   */
  public clear(): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Reset state for clean restart
    this.currentState = null;
    this.lastState = null;
    this.nextState = null;
    this.countdownState = { active: false, count: 0 };
  }

  /**
   * Clean up
   */
  public destroy(): void {
    this.stopRendering();
    
    // Remove event listeners
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('orientationchange', this.resizeHandler);
    
    // Clear state
    this.currentState = null;
    this.lastState = null;
    this.nextState = null;
  }

  /**
   * Sync DOM countdown banner with renderer state.
   */
  private syncCountdownBanner(): void {
    if (!this.countdownBanner) {
      return;
    }

    if (!this.countdownState.active || this.countdownState.count <= 0) {
      this.countdownBanner.classList.add('hidden');
      this.countdownBanner.textContent = '';
      return;
    }

    this.countdownBanner.textContent = this.getCountdownLabel(this.countdownState.count);
    this.countdownBanner.classList.remove('hidden');
  }

  /**
   * Translate countdown number to display text.
   */
  private getCountdownLabel(count: number): string {
    switch (count) {
      case 3:
        return 'READY';
      case 2:
        return 'SET';
      case 1:
        return 'GO!';
      default:
        return count.toString();
    }
  }
}
