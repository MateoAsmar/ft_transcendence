/**
 * Game Client - WebSocket client for game communication
 * Handles all communication with the game server
 * Sends input, receives game state updates
 */

import { io, Socket } from 'socket.io-client';

export interface GameClientEvents {
  onGameFound?: (data: { roomId: string }) => void;
  onGameStart?: (data: any) => void;
  onGameUpdate?: (state: any) => void;
  onScore?: (data: { leftScore: number; rightScore: number; scorer: string; finalScore?: Number[] }) => void;
  onGameEnd?: (data: { winner: string; leftScore: number; rightScore: number, finalScore?: Number[] }) => void;
  onPlayerJoined?: (data: any) => void;
  onPlayerLeft?: (data: any) => void;
  onPlayerReady?: (data: any) => void;
  onCountdown?: (count: number) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface GameClientConfig {
  serverUrl?: string;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
}

export class GameClient {
  private socket: Socket | null = null;
  private events: GameClientEvents;
  private config: GameClientConfig;
  private connected: boolean = false;

  constructor(events: GameClientEvents = {}, config: GameClientConfig = {}) {
    this.events = events;
    this.config = {
      serverUrl: config.serverUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
      autoConnect: config.autoConnect !== false,
      reconnectionAttempts: config.reconnectionAttempts || 5
    };
  }

  /**
   * Connect to game server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // If already connected with a valid socket, just resolve
      if (this.socket?.connected && this.connected) {
        console.log('✅ Already connected to game server');
        resolve();
        return;
      }

      // If there's a disconnected socket lingering, clean it up first
      if (this.socket && !this.socket.connected) {
        console.log('🧹 Cleaning up disconnected socket...');
        try {
          this.socket.removeAllListeners();
          this.socket.close();
        } catch (e) {
          console.warn('Error cleaning up old socket:', e);
        }
        this.socket = null;
      }

      // Authentication now handled by httpOnly cookie
      // No need to check localStorage - backend will validate cookie
      console.log('🎮 Connecting to game server:', this.config.serverUrl);

      // Set timeout for connection + authentication
      const connectionTimeout = setTimeout(() => {
        if (!this.connected) {
          console.error('⏱️ Connection timeout - authentication took too long');
          reject(new Error('timeout'));
        }
      }, 20000); // 20 second timeout

      this.socket = io(this.config.serverUrl!, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnectionAttempts: this.config.reconnectionAttempts,
        withCredentials: true, // Send httpOnly cookies
        timeout: 20000
      });

      // Setup listeners for the new socket
      this.setupSocketListeners();

      // Wait for authentication, not just connection
      this.socket.on('authenticated', (data) => {
        console.log('✅ Authenticated with game server:', data);
        clearTimeout(connectionTimeout);
        this.connected = true;
        if (this.events.onConnect) {
          this.events.onConnect();
        }
        resolve();
      });

      this.socket.on('connect', () => {
        console.log('🔌 Socket connected, waiting for authentication...');
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        clearTimeout(connectionTimeout);
        reject(error);
      });

      this.socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
      });
    });
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from game server');
      this.connected = false;
      if (this.events.onDisconnect) {
        this.events.onDisconnect();
      }
    });

    // Game events
    this.socket.on('gameFound', (data) => {
      console.log('🎮 Game found:', data);
      if (this.events.onGameFound) {
        this.events.onGameFound(data);
      }
    });

    this.socket.on('gameStart', (data) => {
      console.log('🚀 Game starting:', data);
      if (this.events.onGameStart) {
        this.events.onGameStart(data);
      }
    });

    this.socket.on('gameUpdate', (state) => {
      if (this.events.onGameUpdate) {
        this.events.onGameUpdate(state);
      }
    });

    this.socket.on('score', (data) => {
      console.log('⚽ Score:', data);
      if (this.events.onScore) {
        this.events.onScore(data);
      }
    });

    this.socket.on('gameEnd', (data) => {
      console.log('🏁 Game ended:', data);
      if (this.events.onGameEnd) {
        this.events.onGameEnd(data);
      }
    });

    this.socket.on('playerJoined', (data) => {
      console.log('👤 Player joined:', data);
      if (this.events.onPlayerJoined) {
        this.events.onPlayerJoined(data);
      }
    });

    this.socket.on('playerLeft', (data) => {
      console.log('👋 Player left:', data);
      if (this.events.onPlayerLeft) {
        this.events.onPlayerLeft(data);
      }
    });

    this.socket.on('playerReady', (data) => {
      console.log('✅ Player ready:', data);
      if (this.events.onPlayerReady) {
        this.events.onPlayerReady(data);
      }
    });

    this.socket.on('countdown', (count) => {
      if (this.events.onCountdown) {
        this.events.onCountdown(count);
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ Game error:', error);
      if (this.events.onError) {
        this.events.onError(error);
      }
    });
  }

  /**
   * Send paddle movement to server
   */
  public sendPaddleMove(direction: 'up' | 'down' | 'stop', paddleIndex?: number): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Cannot send paddle move: not connected');
      return;
    }
    this.socket.emit('playerMove', { direction, paddleIndex });
  }

  /**
   * Mark player as ready
   */
  public sendReady(): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Cannot send ready: not connected');
      return;
    }
    this.socket.emit('playerReady');
  }

  /**
   * Start matchmaking (find random opponent)
   */
  public findMatch(gameMode?: 'online' | 'local' | 'ai'): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Cannot find match: not connected');
      return;
    }
    console.log('🔍 Finding match...', gameMode ? `(mode: ${gameMode})` : '');
    this.socket.emit('findMatch', gameMode ? { gameMode } : undefined);
  }

  /**
   * Create a private room
   */
  public createPrivateRoom(gameMode?: 'online' | 'local' | 'ai', aiDifficulty?: 'easy' | 'medium' | 'hard'): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Cannot create private room: not connected');
      return;
    }
    console.log('🔒 Creating private room...', gameMode ? `(mode: ${gameMode})` : '', aiDifficulty ? `(difficulty: ${aiDifficulty})` : '');
    this.socket.emit('createPrivateRoom', gameMode ? { gameMode, aiDifficulty } : undefined);
  }

  /**
   * Join a room by code
   */
  public joinRoomByCode(code: string): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Cannot join room: not connected');
      return;
    }
    console.log('🔑 Joining room with code:', code);
    this.socket.emit('joinRoomByCode', { code: code.toUpperCase() });
  }

  /**
   * Join a specific room
   */
  public joinRoom(roomId: string): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Cannot join room: not connected');
      return;
    }
    console.log('🚪 Joining room:', roomId);
    this.socket.emit('joinRoom', { roomId });
  }

  /**
   * Leave current room
   */
  public leaveRoom(): void {
    if (!this.socket?.connected) {
      console.warn('⚠️ Cannot leave room: not connected');
      return;
    }
    console.log('🚪 Leaving room...');
    this.socket.emit('leaveRoom');
  }

  /**
   * Disconnect from server
   */
  public disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting from game server...');
      // Store socket reference before clearing
      const socketToDisconnect = this.socket;
      
      // Clear our reference and state first
      this.socket = null;
      this.connected = false;
      
      // Remove all listeners and disconnect
      try {
        socketToDisconnect.removeAllListeners();
        socketToDisconnect.disconnect();
        socketToDisconnect.close();
      } catch (e) {
        console.warn('Error during disconnect:', e);
      }
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connected && this.socket?.connected === true;
  }

  /**
   * Get socket instance (for advanced usage)
   */
  public getSocket(): Socket | null {
    return this.socket;
  }
}
