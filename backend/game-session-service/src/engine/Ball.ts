/**
 * Ball Entity - Time-Based Physics System
 * 
 * KEY CHANGES:
 * - Velocity is in PIXELS PER SECOND
 * - Position updated using deltaTime for frame-rate independence
 * - Speed increases are in pixels/second
 */

export interface BallState {
  x: number;
  y: number;
  vx: number;      // Velocity X in pixels per second
  vy: number;      // Velocity Y in pixels per second
  radius: number;
  speed: number;   // Current speed magnitude in pixels per second
}

export class Ball {
  public x: number;
  public y: number;
  public prevX: number;    // Previous X position for swept collision
  public prevY: number;    // Previous Y position for swept collision
  public vx: number;       // Pixels per second
  public vy: number;       // Pixels per second
  public radius: number;
  private currentSpeed: number;  // Pixels per second
  private readonly BASE_SPEED: number;
  private readonly SPEED_INCREASE: number;
  private readonly MAX_SPEED: number;
  private readonly SPEED_INTERVAL: number;
  private lastSpeedIncrease: number;
  private roundStartTime: number;

  constructor(
    x: number,
    y: number,
    baseSpeed: number = 350,      // pixels per second
    radius: number = 8,
    speedIncrease: number = 0.5,  // speed multiplier per interval
    maxSpeed: number = 700,       // pixels per second
    speedInterval: number = 5000  // milliseconds (5 seconds)
  ) {
    this.x = x;
    this.y = y;
    this.prevX = x;  // Initialize previous position
    this.prevY = y;
    this.radius = radius;
    this.BASE_SPEED = baseSpeed;
    this.currentSpeed = baseSpeed;
    this.SPEED_INCREASE = speedIncrease;
    this.MAX_SPEED = maxSpeed;
    this.SPEED_INTERVAL = speedInterval;
    this.roundStartTime = Date.now();
    this.lastSpeedIncrease = Date.now();

    // Initialize with random direction
    const angle = (Math.random() * Math.PI / 2) - Math.PI / 4; // -45° to +45°
    const direction = Math.random() > 0.5 ? 1 : -1;

    this.vx = Math.cos(angle) * this.currentSpeed * direction;
    this.vy = Math.sin(angle) * this.currentSpeed;
  }

  /**
   * Update ball position using time delta
   * This is the NEW time-based physics system
   * 
   * @param deltaTime - Time elapsed in SECONDS
   * @param canvasWidth - Canvas width for boundary checking
   * @param canvasHeight - Canvas height for boundary checking
   */
  public update(canvasWidth: number, canvasHeight: number, deltaTime: number = 1/60): void {
    this.checkTimeBasedSpeedIncrease();

    // Validate velocity to prevent NaN
    if (isNaN(this.vx) || isNaN(this.vy)) {
      const angle = (Math.random() * Math.PI / 2) - Math.PI / 4;
      const direction = Math.random() > 0.5 ? 1 : -1;
      this.vx = Math.cos(angle) * this.currentSpeed * direction;
      this.vy = Math.sin(angle) * this.currentSpeed;
    }

    // Store previous position for swept collision detection
    this.prevX = this.x;
    this.prevY = this.y;

    // Update position: position += velocity * time
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;

    // Wall collision (top and bottom) with proper bounds clamping
    if (this.y - this.radius <= 0) {
      this.y = this.radius;  // Clamp to boundary
      this.vy = Math.abs(this.vy);  // Bounce down
    } else if (this.y + this.radius >= canvasHeight) {
      this.y = canvasHeight - this.radius;  // Clamp to boundary
      this.vy = -Math.abs(this.vy);  // Bounce up
    }
    
    // Ensure ball never escapes vertically
    this.y = Math.max(this.radius, Math.min(canvasHeight - this.radius, this.y));
  }

  /**
   * Increase ball speed over time for more challenging gameplay
   * Adds 0.5 multiplier to speed every 5 seconds
   * NO SPEED CAP - continues increasing indefinitely until score/reset
   */
  private checkTimeBasedSpeedIncrease(): void {
    const currentTime = Date.now();

    if (currentTime - this.lastSpeedIncrease >= this.SPEED_INTERVAL) {
      // Add 0.5 multiplier to current speed (no cap!)
      this.currentSpeed = this.currentSpeed + (this.BASE_SPEED * this.SPEED_INCREASE);

      // Maintain direction while increasing speed
      const currentVelocityMagnitude = Math.sqrt(
        this.vx * this.vx + this.vy * this.vy
      );

      if (currentVelocityMagnitude > 0) {
        const velocityRatio = this.currentSpeed / currentVelocityMagnitude;
        this.vx = this.vx * velocityRatio;
        this.vy = this.vy * velocityRatio;
      } else {
        this.vx = Math.random() > 0.5 ? this.currentSpeed : -this.currentSpeed;
        this.vy = (Math.random() - 0.5) * this.currentSpeed;
      }

      this.lastSpeedIncrease = currentTime;
      console.log(`⚡ Ball speed increased to ${Math.round(this.currentSpeed)} px/s (no limit!)`);
    }
  }

  /**
   * Reverse horizontal velocity (paddle collision)
   */
  public reverseX(): void {
    this.vx = -this.vx;
  }

  /**
   * Reverse vertical velocity (wall collision)
   */
  public reverseY(): void {
    this.vy = -this.vy;
  }

  /**
   * Add spin based on paddle hit position
   * @param hitPosition - Normalized position (0-1) where ball hit paddle
   */
  public addSpin(hitPosition: number): void {
    // Add vertical velocity based on where the ball hit
    // hitPosition: 0 = top of paddle, 0.5 = center, 1 = bottom
    this.vy += (hitPosition - 0.5) * 3;
  }

  /**
   * Reset ball to center for new point and reset speed to base
   */
  public resetForNewPoint(canvasWidth: number, canvasHeight: number): void {
    this.x = canvasWidth / 2;
    this.y = canvasHeight / 2;
    this.prevX = this.x;
    this.prevY = this.y;
    // Reset speed to base after each score
    this.currentSpeed = this.BASE_SPEED;
    this.vx = Math.random() > 0.5 ? this.currentSpeed : -this.currentSpeed;
    this.vy = (Math.random() - 0.5) * this.currentSpeed;
    // Reset speed increase timer
    this.lastSpeedIncrease = Date.now();
    console.log(`🔄 Ball reset to base speed: ${this.BASE_SPEED} px/s`);
  }

  /**
   * Full reset for new game (resets speed too)
   */
  public resetForNewGame(canvasWidth: number, canvasHeight: number): void {
    this.x = canvasWidth / 2;
    this.y = canvasHeight / 2;
    this.prevX = this.x;
    this.prevY = this.y;
    this.currentSpeed = this.BASE_SPEED;
    this.vx = Math.random() > 0.5 ? this.currentSpeed : -this.currentSpeed;
    this.vy = (Math.random() - 0.5) * this.currentSpeed;
    this.roundStartTime = Date.now();
    this.lastSpeedIncrease = Date.now();
  }

  /**
   * Reset round timer (after scoring)
   */
  public resetRoundTimer(): void {
    this.roundStartTime = Date.now();
    this.lastSpeedIncrease = Date.now();
  }

  /**
   * Get current ball speed
   */
  public getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  /**
   * Get time elapsed in current round (seconds)
   */
  public getRoundTime(): number {
    return Math.floor((Date.now() - this.roundStartTime) / 1000);
  }

  /**
   * Get time until next speed increase (seconds)
   */
  public getTimeToNextSpeedUp(): number {
    const timeSinceLastIncrease = Date.now() - this.lastSpeedIncrease;
    return Math.max(
      0,
      Math.ceil((this.SPEED_INTERVAL - timeSinceLastIncrease) / 1000)
    );
  }

  /**
   * Get serializable ball state for network transmission
   */
  public getState(): BallState {
    return {
      x: Math.round(this.x * 10) / 10, // Round to 1 decimal
      y: Math.round(this.y * 10) / 10,
      vx: Math.round(this.vx * 10) / 10,
      vy: Math.round(this.vy * 10) / 10,
      radius: this.radius,
      speed: Math.round(this.currentSpeed * 10) / 10
    };
  }

  /**
   * Set ball state (for state synchronization)
   */
  public setState(state: BallState): void {
    this.x = state.x;
    this.y = state.y;
    this.vx = state.vx;
    this.vy = state.vy;
    this.currentSpeed = state.speed;
  }
}
