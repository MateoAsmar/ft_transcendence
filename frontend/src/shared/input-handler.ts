/**
 * Input Handler - Handles keyboard and touch input
 * Sends input to game client (no local game logic)
 */

export type InputDirection = 'up' | 'down' | 'stop';

export interface InputHandlerEvents {
  onPlayer1Input?: (direction: InputDirection) => void;
  onPlayer2Input?: (direction: InputDirection) => void;
}

export class InputHandler {
  private keys: { [key: string]: boolean } = {};
  private events: InputHandlerEvents;
  private lastPlayer1Direction: InputDirection = 'stop';
  private lastPlayer2Direction: InputDirection = 'stop';
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private keydownHandler: (e: KeyboardEvent) => void;
  private keyupHandler: (e: KeyboardEvent) => void;

  constructor(events: InputHandlerEvents = {}) {
    this.events = events;
    
    // Store handlers so they can be removed later
    this.keydownHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // Prevent default for arrow keys and WASD to stop page scrolling
      if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright' ||
          key === 'w' || key === 's' || key === 'a' || key === 'd' || key === ' ') {
        e.preventDefault();
      }
      
      this.keys[key] = true;
      this.updateInputState();
    };
    
    this.keyupHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // Prevent default for arrow keys and WASD to stop page scrolling
      if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright' ||
          key === 'w' || key === 's' || key === 'a' || key === 'd' || key === ' ') {
        e.preventDefault();
      }
      
      this.keys[key] = false;
      this.updateInputState();
    };
    
    this.setupKeyboardListeners();
  }

  /**
   * Setup keyboard event listeners
   */
  private setupKeyboardListeners(): void {
    document.addEventListener('keydown', this.keydownHandler);
    document.addEventListener('keyup', this.keyupHandler);
  }

  /**
   * Setup touch controls for a canvas element
   */
  public setupTouchControls(canvasId: string = 'gameCanvas'): void {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) {
      console.warn('Canvas not found for touch controls');
      return;
    }

    let touchActive = false;
    let currentPlayerSide: 'left' | 'right' | null = null;
    let lastTouchY: number = 0;

    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.canvas!.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const scaleX = this.canvas!.width / rect.width;
        const canvasX = touchX * scaleX;

        touchActive = true;
        currentPlayerSide = canvasX < this.canvas!.width / 2 ? 'left' : 'right';
        lastTouchY = touch.clientY - rect.top;
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        if (!touchActive || !currentPlayerSide) return;

        const touch = e.touches[0];
        const rect = this.canvas!.getBoundingClientRect();
        const touchY = touch.clientY - rect.top;

        // Determine direction based on touch movement
        const deltaY = touchY - lastTouchY;
        const direction: InputDirection = Math.abs(deltaY) < 2 ? 'stop' : deltaY < 0 ? 'up' : 'down';

        if (currentPlayerSide === 'left' && this.events.onPlayer1Input) {
          this.events.onPlayer1Input(direction);
        } else if (currentPlayerSide === 'right' && this.events.onPlayer2Input) {
          this.events.onPlayer2Input(direction);
        }

        lastTouchY = touchY;
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        touchActive = false;
        
        // Send stop input
        if (currentPlayerSide === 'left' && this.events.onPlayer1Input) {
          this.events.onPlayer1Input('stop');
        } else if (currentPlayerSide === 'right' && this.events.onPlayer2Input) {
          this.events.onPlayer2Input('stop');
        }
        
        currentPlayerSide = null;
      },
      { passive: false }
    );

    console.log('✅ Touch controls enabled');
  }

  /**
   * Update input state based on current key presses
   */
  private updateInputState(): void {
    // Player 1 controls (W/S or Arrow keys)
    // Arrow keys work for Player 1 ONLY if Player 2 input handler is not registered (single-player modes)
    let player1Direction: InputDirection = 'stop';
    if (this.keys['w'] || (this.keys['arrowup'] && !this.events.onPlayer2Input)) {
      player1Direction = 'up';
    } else if (this.keys['s'] || (this.keys['arrowdown'] && !this.events.onPlayer2Input)) {
      player1Direction = 'down';
    }

    // Player 2 controls (Arrow keys) - only active in local 2-player mode
    let player2Direction: InputDirection = 'stop';
    if (this.keys['arrowup']) {
      player2Direction = 'up';
    } else if (this.keys['arrowdown']) {
      player2Direction = 'down';
    }

    // During polling mode: Always emit to ensure continuous movement
    // During event mode: Only emit on change to avoid spam
    const isPolling = this.updateInterval !== null;

    if (isPolling) {
      // Continuous mode - always send current direction
      if (this.events.onPlayer1Input) {
        this.events.onPlayer1Input(player1Direction);
      }
      if (this.events.onPlayer2Input) {
        this.events.onPlayer2Input(player2Direction);
      }
      this.lastPlayer1Direction = player1Direction;
      this.lastPlayer2Direction = player2Direction;
    } else {
      // Event mode - only emit when direction changes
      if (player1Direction !== this.lastPlayer1Direction) {
        this.lastPlayer1Direction = player1Direction;
        if (this.events.onPlayer1Input) {
          this.events.onPlayer1Input(player1Direction);
        }
      }

      if (player2Direction !== this.lastPlayer2Direction) {
        this.lastPlayer2Direction = player2Direction;
        if (this.events.onPlayer2Input) {
          this.events.onPlayer2Input(player2Direction);
        }
      }
    }
  }

  /**
   * Start continuous input polling (optional, for games that need it)
   */
  public startPolling(intervalMs: number = 50): void {
    if (this.updateInterval) {
      return; // Already polling
    }

    this.updateInterval = setInterval(() => {
      this.updateInputState();
    }, intervalMs);
  }

  /**
   * Stop input polling
   */
  public stopPolling(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Reset key states and directions when stopping
    this.keys = {};
    this.lastPlayer1Direction = 'stop';
    this.lastPlayer2Direction = 'stop';
  }

  /**
   * Setup mobile button controls
   */
  public setupMobileButtons(): void {
    const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
    if (!isMobile) return;

    const gameContainer = document.querySelector('.game-container') || document.body;
    
    // Check if controls already exist
    if (document.getElementById('mobile-controls')) return;

    const controlsHTML = `
      <div id="mobile-controls" style="
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 20px;
        z-index: 10;
        background: rgba(0, 0, 0, 0.8);
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #22d3ee;
      ">
        <div class="player-controls" style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
          <div style="color: #22d3ee; font-size: 12px; font-weight: bold;">Player 1</div>
          <button id="p1-up" class="mobile-btn" style="
            background: #22d3ee;
            border: none;
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 8px;
            font-size: 20px;
            touch-action: manipulation;
            user-select: none;
          ">▲</button>
          <button id="p1-down" class="mobile-btn" style="
            background: #22d3ee;
            border: none;
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 8px;
            font-size: 20px;
            touch-action: manipulation;
            user-select: none;
          ">▼</button>
        </div>
        <div class="player-controls" style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
          <div style="color: #ec4899; font-size: 12px; font-weight: bold;">Player 2</div>
          <button id="p2-up" class="mobile-btn" style="
            background: #ec4899;
            border: none;
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 8px;
            font-size: 20px;
            touch-action: manipulation;
            user-select: none;
          ">▲</button>
          <button id="p2-down" class="mobile-btn" style="
            background: #ec4899;
            border: none;
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 8px;
            font-size: 20px;
            touch-action: manipulation;
            user-select: none;
          ">▼</button>
        </div>
      </div>
    `;

    gameContainer.insertAdjacentHTML('beforeend', controlsHTML);

    // Setup button event listeners
    this.setupButtonEvents('p1-up', 'w');
    this.setupButtonEvents('p1-down', 's');
    this.setupButtonEvents('p2-up', 'arrowup');
    this.setupButtonEvents('p2-down', 'arrowdown');
  }

  /**
   * Setup button touch events
   */
  private setupButtonEvents(buttonId: string, key: string): void {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.keys[key] = true;
      this.updateInputState();
    }, { passive: false });

    button.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.keys[key] = false;
      this.updateInputState();
    }, { passive: false });

    // Also handle mouse events for testing
    button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.keys[key] = true;
      this.updateInputState();
    });

    button.addEventListener('mouseup', (e) => {
      e.preventDefault();
      this.keys[key] = false;
      this.updateInputState();
    });
  }

  /**
   * Clean up event listeners
   */
  public destroy(): void {
    this.stopPolling();
    
    // Remove keyboard event listeners
    document.removeEventListener('keydown', this.keydownHandler);
    document.removeEventListener('keyup', this.keyupHandler);
    
    // Remove mobile controls if they exist
    const mobileControls = document.getElementById('mobile-controls');
    if (mobileControls) {
      mobileControls.remove();
    }
    
    // Clear keys
    this.keys = {};
  }
}
