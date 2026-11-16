/**
 * Paddle Entity - Time-Based Movement System
 * 
 * KEY CHANGE: Movement is now time-based (pixels per second)
 * Speed is in PIXELS PER SECOND, not pixels per frame
 * This ensures consistent movement regardless of update frequency
 */

export interface PaddleState {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

export type PaddleInput = 'up' | 'down' | 'stop';

export class Paddle {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public speed: number;  // PIXELS PER SECOND
  private canvasHeight: number;
  
  // Current input state
  private currentInput: PaddleInput = 'stop';

  constructor(
    x: number,
    y: number,
    width: number = 6,
    height: number = 80,
    speed: number = 500,  // Default: 500 pixels per second
    canvasHeight: number = 700
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.canvasHeight = canvasHeight;
  }

  /**
   * Set current input direction
   */
  public setInput(input: PaddleInput): void {
    this.currentInput = input;
  }

  /**
   * Update paddle position based on time delta
   * This is the NEW time-based movement system
   * 
   * @param deltaTime - Time elapsed in SECONDS
   */
  public update(deltaTime: number): void {
    if (this.currentInput === 'stop') {
      return;
    }

    // Calculate movement: speed (px/sec) * time (sec) = pixels
    const movement = this.speed * deltaTime;

    if (this.currentInput === 'up') {
      this.y = Math.max(0, this.y - movement);
    } else if (this.currentInput === 'down') {
      this.y = Math.min(this.canvasHeight - this.height, this.y + movement);
    }
  }

  /**
   * Update with explicit input (alternative method)
   */
  public updateWithInput(input: PaddleInput, deltaTime: number): void {
    if (input === 'stop') {
      return;
    }

    const movement = this.speed * deltaTime;

    if (input === 'up') {
      this.y = Math.max(0, this.y - movement);
    } else if (input === 'down') {
      this.y = Math.min(this.canvasHeight - this.height, this.y + movement);
    }
  }

  /**
   * LEGACY: Move paddle up (kept for backwards compatibility)
   * WARNING: This uses frame-based movement - prefer update() instead
   */
  public moveUp(): boolean {
    // Convert to per-frame movement (assume 60 FPS)
    const movement = this.speed / 60;
    if (this.y > 0) {
      this.y = Math.max(0, this.y - movement);
      return true;
    }
    return false;
  }

  /**
   * LEGACY: Move paddle down (kept for backwards compatibility)
   * WARNING: This uses frame-based movement - prefer update() instead
   */
  public moveDown(): boolean {
    // Convert to per-frame movement (assume 60 FPS)
    const movement = this.speed / 60;
    if (this.y < this.canvasHeight - this.height) {
      this.y = Math.min(this.canvasHeight - this.height, this.y + movement);
      return true;
    }
    return false;
  }

  /**
   * Set paddle position directly (with bounds checking)
   */
  public setPosition(y: number): void {
    this.y = Math.max(0, Math.min(this.canvasHeight - this.height, y));
  }

  /**
   * Reset paddle to initial position
   */
  public reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * Update canvas height (if game dimensions change)
   */
  public updateCanvasHeight(height: number): void {
    this.canvasHeight = height;
    // Ensure paddle is still within bounds
    this.y = Math.max(0, Math.min(this.canvasHeight - this.height, this.y));
  }

  /**
   * Get serializable paddle state for network transmission
   */
  public getState(): PaddleState {
    return {
      x: Math.round(this.x * 10) / 10, // Round to 1 decimal
      y: Math.round(this.y * 10) / 10,
      width: this.width,
      height: this.height,
      speed: this.speed
    };
  }

  /**
   * Set paddle state (for state synchronization)
   */
  public setState(state: PaddleState): void {
    this.x = state.x;
    this.y = state.y;
    this.width = state.width;
    this.height = state.height;
    this.speed = state.speed;
  }

  /**
   * Check if a point is within paddle bounds
   */
  public containsPoint(x: number, y: number): boolean {
    return (
      x >= this.x &&
      x <= this.x + this.width &&
      y >= this.y &&
      y <= this.y + this.height
    );
  }

  /**
   * Get center Y position of paddle
   */
  public getCenterY(): number {
    return this.y + this.height / 2;
  }

  /**
   * Get normalized hit position (0-1) for a given Y coordinate
   * Used for calculating ball spin
   */
  public getHitPosition(ballY: number): number {
    const relativeY = ballY - this.y;
    return Math.max(0, Math.min(1, relativeY / this.height));
  }
}
