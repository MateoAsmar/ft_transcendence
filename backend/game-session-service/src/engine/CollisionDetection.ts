/**
 * Collision Detection Utilities
 * Handles all collision detection between game entities
 */

import { Ball } from './Ball';
import { Paddle } from './Paddle';

export interface CollisionResult {
  collided: boolean;
  hitPosition?: number; // Normalized 0-1 position on paddle
  side?: 'left' | 'right' | 'top' | 'bottom';
}

export class CollisionDetection {
  /**
   * Check collision between ball and paddle using swept collision detection
   * This prevents tunneling at high speeds by checking the ball's movement path
   * Returns collision info including hit position for spin calculation
   */
  public static checkBallPaddleCollision(
    ball: Ball,
    paddle: Paddle,
    side: 'left' | 'right'
  ): CollisionResult {
    // Check velocity direction to prevent double collisions
    const correctDirection = side === 'left' ? ball.vx < 0 : ball.vx > 0;
    if (!correctDirection) {
      return { collided: false };
    }

    // Expand paddle bounds by ball radius (Minkowski sum approach)
    const paddleLeft = paddle.x - ball.radius;
    const paddleRight = paddle.x + paddle.width + ball.radius;
    const paddleTop = paddle.y - ball.radius;
    const paddleBottom = paddle.y + paddle.height + ball.radius;

    // Use swept collision: check if line segment from prevPos to currentPos intersects paddle
    const intersects = this.lineIntersectsRect(
      ball.prevX, ball.prevY,
      ball.x, ball.y,
      paddleLeft, paddleTop,
      paddleRight - paddleLeft, paddleBottom - paddleTop
    );

    if (intersects) {
      // Calculate normalized hit position (0 = top, 1 = bottom)
      // Use the current ball Y position for spin calculation
      const hitPosition = paddle.getHitPosition(ball.y);

      return {
        collided: true,
        hitPosition,
        side
      };
    }

    return { collided: false };
  }

  /**
   * Check if a line segment intersects a rectangle
   * Uses Liang-Barsky algorithm for efficient line-rectangle intersection
   */
  private static lineIntersectsRect(
    x1: number, y1: number,  // Line start
    x2: number, y2: number,  // Line end
    rx: number, ry: number,  // Rectangle position
    rw: number, rh: number   // Rectangle size
  ): boolean {
    // Direction vector
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Edge case: no movement
    if (dx === 0 && dy === 0) {
      // Point-in-rectangle test
      return x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh;
    }

    // Liang-Barsky algorithm parameters
    let t0 = 0.0;
    let t1 = 1.0;

    // Check each edge of the rectangle
    const edges = [
      { p: -dx, q: x1 - rx },        // Left edge
      { p: dx, q: rx + rw - x1 },    // Right edge
      { p: -dy, q: y1 - ry },        // Top edge
      { p: dy, q: ry + rh - y1 }     // Bottom edge
    ];

    for (const edge of edges) {
      if (edge.p === 0) {
        // Line is parallel to this edge
        if (edge.q < 0) {
          return false; // Line is outside rectangle
        }
      } else {
        const t = edge.q / edge.p;
        if (edge.p < 0) {
          // Entering edge
          if (t > t1) return false;
          if (t > t0) t0 = t;
        } else {
          // Exiting edge
          if (t < t0) return false;
          if (t < t1) t1 = t;
        }
      }
    }

    return t0 <= t1;
  }

  /**
   * Check if ball hit top or bottom wall
   */
  public static checkBallWallCollision(
    ball: Ball,
    canvasHeight: number
  ): CollisionResult {
    if (ball.y - ball.radius <= 0) {
      return { collided: true, side: 'top' };
    } else if (ball.y + ball.radius >= canvasHeight) {
      return { collided: true, side: 'bottom' };
    }
    return { collided: false };
  }

  /**
   * Check if ball went off left or right edge (scoring)
   */
  public static checkBallOutOfBounds(
    ball: Ball,
    canvasWidth: number
  ): 'left' | 'right' | null {
    if (ball.x - ball.radius <= 0) {
      return 'left';
    } else if (ball.x + ball.radius >= canvasWidth) {
      return 'right';
    }
    return null;
  }

  /**
   * Check if two circles are colliding (for power-ups, etc.)
   */
  public static checkCircleCollision(
    x1: number,
    y1: number,
    r1: number,
    x2: number,
    y2: number,
    r2: number
  ): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < r1 + r2;
  }

  /**
   * Check if a point is inside a rectangle
   */
  public static pointInRect(
    px: number,
    py: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number
  ): boolean {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }

  /**
   * Get distance between two points
   */
  public static distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate angle between two points (in radians)
   */
  public static angleBetween(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1);
  }

  /**
   * Clamp a value between min and max
   */
  public static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
