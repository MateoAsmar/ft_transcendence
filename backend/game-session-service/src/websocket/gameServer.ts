import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import {
  getDatabase,
  type PresenceStatusEvent,
  type GameResultEvent,
} from "../lib";
import { GAME_CONSTANTS } from "./game-constants";
import { GameEngine, type GameSettings as EngineGameSettings } from "../engine";

const db = getDatabase();

interface Player {
  id: string;
  userId: number;
  username: string;
  socketId: string;
  paddle: {
    y: number;
    speed: number;
  };
  score: number;
  ready: boolean;
}

interface GameRoom {
  id: string;
  players: Player[];
  spectators: Array<{
    id: string;
    userId: number;
    username: string;
    socketId: string;
  }>;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    speed: number;
  };
  gameState: "waiting" | "ready" | "playing" | "paused" | "finished";
  gameMode?: "online" | "local" | "ai"; // Add game mode field
  aiDifficulty?: "easy" | "medium" | "hard"; // AI difficulty level
  winner?: string;
  createdAt: Date;
  lastUpdate: Date;
  gameSettings: {
    maxScore: number;
    ballSpeed: number;
    paddleSpeed: number;
    width: number;
    height: number;
    paddleWidth: number; // Add paddleWidth for frontend
    paddleHeight: number; // Add paddleHeight for frontend
    ballSize: number; // Add ballSize for frontend
  };
  // Tournament-specific fields
  tournamentId?: string;
  matchId?: string;
  tournamentMatch?: boolean;
  allowedPlayers?: number[];
}

// Tournament-specific interfaces
interface TournamentPlayer {
  id: string;
  userId: number;
  username: string;
  socketId?: string;
  isAI?: boolean;
  eliminated?: boolean;
}

interface TournamentMatch {
  id: string;
  player1: TournamentPlayer | null;
  player2: TournamentPlayer | null;
  winner: TournamentPlayer | null;
  round: number;
  matchIndex: number;
  completed: boolean;
  nextMatchId?: string;
  position: "top" | "bottom";
  roomId?: string;
  gameInProgress?: boolean;
}

interface Tournament {
  id: string;
  name: string;
  creatorId: number;
  joinCode: string;
  players: TournamentPlayer[];
  matches: TournamentMatch[];
  rounds: number;
  currentRound: number;
  size: number;
  gameMode: "remote";
  matchType: number; // Points to win
  completed: boolean;
  winner: TournamentPlayer | null;
  createdAt: Date;
  status: "setup" | "active" | "completed";
  spectators: Array<{
    userId: number;
    username: string;
    socketId: string;
  }>;
}

interface GameServerOptions {
  onPresenceChange?: (event: PresenceStatusEvent) => Promise<void>;
  onGameResult?: (event: GameResultEvent) => Promise<void>;
}

export class GameServer {
  private io: SocketIOServer;
  private rooms: Map<string, GameRoom> = new Map();
  private playerToRoom: Map<string, string> = new Map();
  private gameLoops: Map<string, NodeJS.Timeout> = new Map();
  private gameEngines: Map<string, GameEngine> = new Map(); // New: Track GameEngine instances per room
  private roomCodes: Map<string, string> = new Map(); // Maps room code -> room ID
  private userSockets: Map<number, string> = new Map(); // Maps user ID -> socket ID
  private options: GameServerOptions;

  // Tournament management
  private tournaments: Map<string, Tournament> = new Map();
  private playerToTournament: Map<number, string> = new Map(); // Maps user ID -> tournament ID
  private joinCodeToTournament: Map<string, string> = new Map();

  constructor(httpServer: HTTPServer, options?: GameServerOptions) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: true, // Allow any origin since nginx handles the actual routing
        methods: ["GET", "POST"],
        credentials: true,
      },
      path: "/socket.io",
    });
    this.options = options ?? {};

    // Authenticate sockets using auth_token cookie during handshake
    this.io.use((socket, next) => {
      try {
        console.log("🔐 WebSocket auth attempt:", {
          headers: socket.handshake.headers,
          auth: socket.handshake.auth,
        });
        const cookieHeader = socket.handshake.headers.cookie || "";
        console.log("🍪 Cookie header:", cookieHeader);
        const cookies = Object.fromEntries(
          cookieHeader
            .split(";")
            .map((p) => {
              const [k, ...rest] = p.trim().split("=");
              return [
                decodeURIComponent(k || ""),
                decodeURIComponent(rest.join("=") || ""),
              ];
            })
            .filter(([k]) => k)
        );
        console.log("🍪 Parsed cookies:", Object.keys(cookies));
        const token = cookies["auth_token"];
        if (!token) {
          console.error("❌ No auth_token cookie found");
          return next(new Error("unauthorized"));
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          console.error("❌ CRITICAL: JWT_SECRET not configured!");
          return next(new Error("Server configuration error"));
        }

        const decoded = jwt.verify(token, jwtSecret) as any;
        console.log("✅ JWT decoded:", decoded);
        const userId = decoded.userId || decoded.user_id;
        console.log("🔑 Looking up user ID:", userId);
        const user = db
          .prepare("SELECT id, username FROM users WHERE id = ?")
          .get(userId) as any;
        console.log("👤 User found:", user);
        if (!user) {
          console.error("❌ User not found in database");
          return next(new Error("unauthorized"));
        }
        socket.data.user = user;
        this.notifyPresence({
          userId: user.id,
          username: user.username,
          status: "online",
        });
        console.log(
          "✅ WebSocket authenticated successfully for user:",
          user.username
        );
        return next();
      } catch (err) {
        console.error("❌ WebSocket auth error:", err);
        return next(new Error("unauthorized"));
      }
    });

    this.setupEventHandlers();
    console.log("🎮 Game WebSocket server initialized");
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`🔌 User connected: ${socket.id}`);

      // If middleware authenticated the socket, announce it and register online status
      if (socket.data.user) {
        const user = socket.data.user as { id: number; username: string };
        this.userSockets.set(user.id, socket.id);
        this.notifyFriendsOnlineStatus(user.id, true);
        this.notifyPresence({
          userId: user.id,
          username: user.username,
          status: "online",
        });
        socket.emit("authenticated", { success: true, user });
      }

      // Backwards compatibility: token-based authenticate event (not required when cookie is present)
      socket.on("authenticate", async (token: string) => {
        console.log(
          `🔍 Authenticating token: ${token.substring(0, 20)}... (${
            token.length
          } chars)`
        );

        try {
          // Allow test tokens for development
          if (token.startsWith("mock_token_")) {
            const username = token.replace("mock_token_", "");
            const mockUser = {
              id: Math.floor(Math.random() * 1000) + 1000, // Generate random test user ID
              username: username,
            };
            socket.data.user = mockUser;
            socket.emit("authenticated", { success: true, user: mockUser });
            console.log(
              `✅ Mock token authenticated: ${mockUser.username} (${socket.id})`
            );
            return;
          }

          // Allow quick session tokens for cross-computer play
          if (token.startsWith("quick_")) {
            const parts = token.split("_");
            const username = parts[1]; // Extract username from quick_username_timestamp
            if (!username) {
              console.log(`❌ Invalid quick token format: ${token}`);
              socket.emit("authenticated", {
                success: false,
                error: "Invalid quick token format",
              });
              return;
            }
            const mockUser = {
              id: Math.floor(Math.random() * 1000) + 2000, // Different ID range for quick sessions
              username: username,
            };
            socket.data.user = mockUser;
            socket.emit("authenticated", { success: true, user: mockUser });
            console.log(
              `✅ Quick session authenticated: ${mockUser.username} (${socket.id})`
            );
            return;
          }

          // Try to verify as JWT token
          console.log(
            `🔍 Attempting JWT verification for token starting with: ${token.substring(
              0,
              10
            )}`
          );
          const jwtSecretForVerify = process.env.JWT_SECRET;
          if (!jwtSecretForVerify) {
            console.error("❌ CRITICAL: JWT_SECRET not configured!");
            socket.emit("authenticated", {
              success: false,
              error: "Server configuration error",
            });
            return;
          }
          const decoded = jwt.verify(token, jwtSecretForVerify) as any;
          console.log(`🔍 JWT decoded:`, decoded);

          // Handle both userId and user_id fields (different JWT formats)
          const userId = decoded.userId || decoded.user_id;
          console.log(
            `🔍 Extracted userId: ${userId} (from decoded.userId: ${decoded.userId}, decoded.user_id: ${decoded.user_id})`
          );

          const user = db
            .prepare("SELECT id, username FROM users WHERE id = ?")
            .get(userId) as any;
          console.log(`🔍 Database query result for userId ${userId}:`, user);
          if (user) {
            socket.data.user = user;
            // Track user socket for friend system
            this.userSockets.set(user.id, socket.id);

            // Notify friends that user came online
            this.notifyFriendsOnlineStatus(user.id, true);
            this.notifyPresence({
              userId: user.id,
              username: user.username,
              status: "online",
            });

            socket.emit("authenticated", { success: true, user });
            console.log(
              `✅ JWT user authenticated: ${user.username} (${socket.id})`
            );
          } else {
            console.log(`❌ User not found in database for ID: ${userId}`);
            socket.emit("authenticated", {
              success: false,
              error: "User not found",
            });
          }
        } catch (error) {
          console.log(
            `❌ Authentication error for token "${token.substring(0, 20)}...":`,
            error instanceof Error ? error.message : "Unknown error"
          );
          socket.emit("authenticated", {
            success: false,
            error: "Invalid token",
          });
        }
      });

      // Create or join game room
      socket.on("findGame", () => {
        console.log(`🎮 findGame event received from socket ${socket.id}`);

        if (!socket.data.user) {
          console.error(`❌ Socket ${socket.id} not authenticated`);
          socket.emit("error", "Not authenticated");
          return;
        }

        console.log(
          `🎮 Player ${socket.data.user.username} (ID: ${socket.data.user.id}) looking for game...`
        );
        console.log(
          `📊 Current state: ${this.rooms.size} rooms, ${this.playerToRoom.size} players mapped`
        );

        // Clean up any stale entries for this user from previous disconnects
        this.cleanupStalePlayerEntries(socket.data.user.id);

        // Check if player is already in a room
        const existingRoomId = this.playerToRoom.get(socket.id);
        if (existingRoomId) {
          console.log(
            `⚠️ Player ${socket.data.user.username} already in room ${existingRoomId}`
          );
          const existingRoom = this.rooms.get(existingRoomId);
          if (existingRoom) {
            // Send current room state
            socket.emit("gameFound", { roomId: existingRoomId });
            const playerJoinedData = {
              players: existingRoom.players.map((p) => ({
                id: p.id,
                username: p.username,
                score: p.score,
                ready: p.ready,
              })),
              gameState: existingRoom.gameState,
              isRoomFull: existingRoom.players.length === 2,
              gameSettings: existingRoom.gameSettings, // <-- Send game settings to frontend
            };
            socket.emit("playerJoined", playerJoinedData);
            return;
          }
        }

        const roomId = this.findOrCreateRoom(socket);
        console.log(
          `✅ Player ${socket.data.user.username} processing completed for room ${roomId}`
        );
        // Note: gameFound event is now sent from within joinRoom method
      });

      // List active rooms
      socket.on("listRooms", () => {
        if (!socket.data.user) {
          socket.emit("error", "Not authenticated");
          return;
        }

        const privateRoomIds = new Set(this.roomCodes.values());

        const roomList = Array.from(this.rooms.values()).map((room) => ({
          id: room.id,
          players: room.players.map((p) => ({
            username: p.username,
            score: p.score,
          })),
          spectatorCount: room.spectators.length,
          gameState: room.gameState,
          canJoin: room.players.length < 2 && room.gameState === "waiting",
          canSpectate:
            room.gameState === "playing" || room.gameState === "ready",
          isPrivate:
            privateRoomIds.has(room.id) || room.id.startsWith("private_"),
          hostUsername: room.players[0]?.username || null,
        }));

        socket.emit("roomList", roomList);
      });

      // Player ready
      socket.on("playerReady", () => {
        const roomId = this.playerToRoom.get(socket.id);
        if (roomId) {
          this.handlePlayerReady(roomId, socket.id);
        }
      });

      // Player movement
      socket.on(
        "playerMove",
        (data: { direction: "up" | "down" | "stop"; paddleIndex?: number }) => {
          const roomId = this.playerToRoom.get(socket.id);
          if (roomId) {
            this.handlePlayerMove(
              roomId,
              socket.id,
              data.direction,
              data.paddleIndex
            );
          }
        }
      );

      // Leave game
      socket.on("leaveGame", () => {
        this.handlePlayerLeave(socket.id);
      });

      // Join specific room
      socket.on("joinRoom", (data: { roomId: string }) => {
        if (!socket.data.user) {
          socket.emit("error", "Not authenticated");
          return;
        }
        this.handleJoinSpecificRoom(data.roomId, socket);
      });

      // Spectate game
      socket.on("spectateGame", (data: { roomId: string }) => {
        if (!socket.data.user) {
          socket.emit("error", "Not authenticated");
          return;
        }
        this.handleSpectatorJoin(data.roomId, socket);
      });

      // Stop spectating
      socket.on("stopSpectating", () => {
        this.handleSpectatorLeave(socket.id);
      });

      // Create private room
      socket.on(
        "createPrivateRoom",
        (data?: {
          gameMode?: "online" | "local" | "ai";
          aiDifficulty?: "easy" | "medium" | "hard";
        }) => {
          if (!socket.data.user) {
            socket.emit("error", "Not authenticated");
            return;
          }
          this.handleCreatePrivateRoom(socket, data);
        }
      );

      // Join room by code
      socket.on("joinRoomByCode", (data: { code: string }) => {
        if (!socket.data.user) {
          socket.emit("error", "Not authenticated");
          return;
        }
        this.handleJoinRoomByCode(socket, data.code);
      });

      // Tournament event handlers

      // Create tournament
      socket.on(
        "createTournament",
        (data: { name: string; size: number; matchType: number }) => {
          if (!socket.data.user) {
            socket.emit("error", "Not authenticated");
            return;
          }
          this.handleCreateTournament(socket, data);
        }
      );

      // Join tournament (by ID or join code)
      socket.on(
        "joinTournament",
        (data: { tournamentId?: string; joinCode?: string }) => {
          if (!socket.data.user) {
            socket.emit("error", "Not authenticated");
            return;
          }
          this.handleJoinTournament(socket, data.tournamentId, data.joinCode);
        }
      );

      // Leave tournament
      socket.on("leaveTournament", () => {
        if (!socket.data.user) {
          socket.emit("error", "Not authenticated");
          return;
        }
        this.handleLeaveTournament(socket);
      });

      // Start tournament
      socket.on("startTournament", (data: { tournamentId: string }) => {
        if (!socket.data.user) {
          socket.emit("error", "Not authenticated");
          return;
        }
        this.handleStartTournament(socket, data.tournamentId);
      });

      // Tournament match ready
      socket.on(
        "tournamentMatchReady",
        (data: { tournamentId: string; matchId: string }) => {
          if (!socket.data.user) {
            socket.emit("error", "Not authenticated");
            return;
          }
          this.handleTournamentMatchReady(
            socket,
            data.tournamentId,
            data.matchId
          );
        }
      );

      // Tournament match result
      socket.on(
        "tournamentMatchResult",
        (data: { tournamentId: string; matchId: string; winnerId: string }) => {
          if (!socket.data.user) {
            socket.emit("error", "Not authenticated");
            return;
          }
          this.handleTournamentMatchResult(
            data.tournamentId,
            data.matchId,
            data.winnerId
          );
        }
      );

      // Spectate tournament
      socket.on("spectateTournament", (data: { tournamentId: string }) => {
        if (!socket.data.user) {
          socket.emit("error", "Not authenticated");
          return;
        }
        this.handleSpectateTournament(socket, data.tournamentId);
      });

      // List tournaments
      socket.on("listTournaments", () => {
        if (!socket.data.user) {
          socket.emit("error", "Not authenticated");
          return;
        }
        this.handleListTournaments(socket);
      });

      // Invite to tournament
      socket.on(
        "inviteToTournament",
        (data: { tournamentId: string; friendId: number }) => {
          if (!socket.data.user) {
            socket.emit("error", "Not authenticated");
            return;
          }
          this.handleInviteToTournament(
            socket,
            data.tournamentId,
            data.friendId
          );
        }
      );

      // Accept tournament invitation
      socket.on("acceptTournamentInvite", (data: { tournamentId: string }) => {
        if (!socket.data.user) {
          socket.emit("error", "Not authenticated");
          return;
        }
        this.handleAcceptTournamentInvite(socket, data.tournamentId);
      });

      // Disconnect handler
      socket.on("disconnect", () => {
        console.log(
          `🔌 User disconnected: ${socket.id}${
            socket.data.user ? ` (${socket.data.user.username})` : ""
          }`
        );

        // Remove from user sockets tracking and notify friends
        if (socket.data.user) {
          const user = socket.data.user as { id: number; username: string };
          this.userSockets.delete(user.id);
          // Notify friends that user went offline
          this.notifyFriendsOnlineStatus(user.id, false);
          this.notifyPresence({
            userId: user.id,
            username: user.username,
            status: "offline",
          });
        }

        this.handlePlayerLeave(socket.id);
        this.handleSpectatorLeave(socket.id);
      });
    });
  }

  private generateJoinCode(): string {
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const codeLength = 6;
    let code = "";

    do {
      code = Array.from(
        { length: codeLength },
        () => charset[Math.floor(Math.random() * charset.length)]
      ).join("");
    } while (this.joinCodeToTournament.has(code));

    return code;
  }

  private findOrCreateRoom(socket: any): string {
    console.log(
      `🔍 Finding or creating room for ${socket.data.user.username} (ID: ${socket.data.user.id})`
    );
    console.log(`🔍 Available rooms: ${this.rooms.size}`);

    // Find existing room with space (prioritize rooms that need exactly 1 more player)
    for (const [roomId, room] of this.rooms.entries()) {
      console.log(
        `🔍 Checking room ${roomId}: ${room.players.length} players, state: ${room.gameState}`
      );

      if (room.players.length === 1 && room.gameState === "waiting") {
        // Check if this player is not already in this room (by socket ID or user ID)
        const isAlreadyInRoom = room.players.some(
          (p) => p.socketId === socket.id || p.userId === socket.data.user.id
        );

        if (isAlreadyInRoom) {
          console.log(
            `⚠️ Player ${socket.data.user.username} already in room ${roomId}, skipping`
          );
          continue;
        }

        console.log(
          `✅ Found suitable room ${roomId} with player: ${room.players[0].username}`
        );
        console.log(
          `🤝 Matching ${socket.data.user.username} with ${room.players[0].username}`
        );
        this.joinRoom(roomId, socket);
        return roomId;
      }
    }

    // Create new room if no suitable room found
    const roomId = `room_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log(
      `🆕 No suitable room found, creating new room ${roomId} for ${socket.data.user.username}`
    );
    this.createRoom(roomId, socket);
    return roomId;
  }

  private createRoom(roomId: string, socket: any) {
    const gameRoom: GameRoom = {
      id: roomId,
      players: [],
      spectators: [],
      ball: {
        x: GAME_CONSTANTS.CANVAS.WIDTH / 2,
        y: GAME_CONSTANTS.CANVAS.HEIGHT / 2,
        vx: GAME_CONSTANTS.BALL.INITIAL_SPEED,
        vy: GAME_CONSTANTS.BALL.INITIAL_SPEED * 0.75,
        speed: GAME_CONSTANTS.BALL.INITIAL_SPEED,
      },
      gameState: "waiting",
      createdAt: new Date(),
      lastUpdate: new Date(),
      gameSettings: {
        maxScore: GAME_CONSTANTS.RULES.WINNING_SCORE,
        ballSpeed: GAME_CONSTANTS.BALL.INITIAL_SPEED,
        paddleSpeed: GAME_CONSTANTS.PADDLE.SPEED,
        width: GAME_CONSTANTS.CANVAS.WIDTH,
        height: GAME_CONSTANTS.CANVAS.HEIGHT,
        paddleWidth: GAME_CONSTANTS.PADDLE.WIDTH,
        paddleHeight: GAME_CONSTANTS.PADDLE.HEIGHT,
        ballSize: GAME_CONSTANTS.BALL.RADIUS * 2,
      },
    };

    this.rooms.set(roomId, gameRoom);
    this.joinRoom(roomId, socket);
    console.log(`🎮 Created room: ${roomId}`);
  }

  private joinRoom(roomId: string, socket: any) {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length >= 2) return;

    // Check tournament room access control
    if (
      room.tournamentMatch &&
      room.allowedPlayers &&
      room.allowedPlayers.length > 0
    ) {
      const isAllowed = room.allowedPlayers.includes(socket.data.user.id);
      if (!isAllowed) {
        console.log(
          `🚫 User ${socket.data.user.username} (ID: ${socket.data.user.id}) not allowed in tournament room ${roomId}`
        );
        socket.emit(
          "error",
          "You are not a participant in this tournament match"
        );
        return;
      }
    }

    // Check if this user is already in the room (by user ID)
    const existingPlayer = room.players.find(
      (p) => p.userId === socket.data.user.id
    );
    if (existingPlayer) {
      console.log(
        `⚠️ User ${socket.data.user.username} (ID: ${socket.data.user.id}) is already in room ${roomId}`
      );
      // Update socket ID if it changed (reconnection scenario)
      existingPlayer.socketId = socket.id;
      this.playerToRoom.set(socket.id, roomId);
      socket.join(roomId);

      // Send current room state
      socket.emit("gameFound", { roomId });

      const playerJoinedData = {
        players: room.players.map((p) => ({
          id: p.id,
          username: p.username,
          score: p.score,
          ready: p.ready,
        })),
        gameState: room.gameState,
        isRoomFull: room.players.length === 2,
        gameSettings: room.gameSettings, // <-- Send game settings to frontend
      };

      socket.emit("playerJoined", playerJoinedData);
      return;
    }

    // Re-fetch user data from database to get latest username
    const freshUser = db
      .prepare("SELECT id, username FROM users WHERE id = ?")
      .get(socket.data.user.id) as any;
    if (freshUser) {
      socket.data.user = freshUser; // Update cached user data
    }

    const player: Player = {
      id: socket.data.user.id.toString(),
      userId: socket.data.user.id,
      username: socket.data.user.username,
      socketId: socket.id,
      paddle: {
        y: GAME_CONSTANTS.CANVAS.HEIGHT / 2 - GAME_CONSTANTS.PADDLE.HEIGHT / 2,
        speed: GAME_CONSTANTS.PADDLE.SPEED,
      },
      score: 0,
      ready: false,
    };

    room.players.push(player);
    this.playerToRoom.set(socket.id, roomId);
    socket.join(roomId);

    // Send gameFound to the player who just joined
    console.log(
      `🎮 Sending gameFound to ${player.username} for room ${roomId}`
    );
    socket.emit("gameFound", { roomId });

    // Prepare player data for notifications
    const playerJoinedData = {
      players: room.players.map((p) => ({
        id: p.id,
        username: p.username,
        score: p.score,
        ready: p.ready,
      })),
      gameState: room.gameState,
      isRoomFull: room.players.length === 2,
      gameSettings: room.gameSettings, // <-- Send game settings to frontend
    };

    console.log(
      `📢 Emitting playerJoined event to room ${roomId} with ${room.players.length} players:`,
      JSON.stringify(playerJoinedData)
    );

    // Use a small delay to ensure gameFound is processed first
    setTimeout(() => {
      // Notify all players in room about the updated player list
      this.io.to(roomId).emit("playerJoined", playerJoinedData);
    }, 10);

    console.log(
      `👤 Player ${player.username} joined room ${roomId} (${room.players.length}/2)`
    );
  }

  private handlePlayerReady(roomId: string, socketId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return;

    player.ready = true;
    console.log(
      `✅ Player ${player.username} is ready in room ${roomId} (mode: ${
        room.gameMode || "online"
      })`
    );

    // Check if all players are ready
    // For local and AI modes, only 1 player is needed (they control both paddles or play against AI)
    // For online mode, 2 players are needed
    const requiredPlayers =
      room.gameMode === "local" || room.gameMode === "ai" ? 1 : 2;
    const allReady =
      room.players.length >= requiredPlayers &&
      room.players.every((p) => p.ready);

    if (allReady) {
      // For local and AI modes, create a virtual second player if needed
      if (
        (room.gameMode === "local" || room.gameMode === "ai") &&
        room.players.length === 1
      ) {
        const virtualPlayer: Player = {
          id: `virtual_${room.id}`,
          userId: -1,
          username: room.gameMode === "ai" ? "AI Opponent" : "Player 2",
          socketId: "",
          paddle: {
            y:
              room.gameSettings.height / 2 - room.gameSettings.paddleHeight / 2,
            speed: room.gameSettings.paddleSpeed,
          },
          score: 0,
          ready: true,
        };
        room.players.push(virtualPlayer);
        console.log(
          `🤖 Created virtual ${
            room.gameMode === "ai" ? "AI" : "local"
          } player for room ${roomId}`
        );
      }

      room.gameState = "playing";

      // Reset game state for new game
      room.players[0].score = 0;
      if (room.players[1]) {
        room.players[1].score = 0;
      }

      // Reset ball to center with proper velocity
      room.ball.x = room.gameSettings.width / 2;
      room.ball.y = room.gameSettings.height / 2;
      room.ball.vx = Math.random() > 0.5 ? room.ball.speed : -room.ball.speed;
      room.ball.vy = (Math.random() - 0.5) * room.ball.speed * 0.8;

      console.log(
        `🚀 Starting game in room ${roomId} with ball: x=${room.ball.x}, y=${room.ball.y}, vx=${room.ball.vx}, vy=${room.ball.vy}`
      );

      this.startGameLoop(roomId);

      this.io.to(roomId).emit("gameStart", {
        gameSettings: room.gameSettings,
        players: room.players.map((p) => ({
          id: p.id,
          username: p.username,
          score: p.score,
          paddle: p.paddle,
        })),
        ball: room.ball,
      });
    } else {
      this.io.to(roomId).emit("playerReady", {
        playerId: player.id,
        allReady,
      });
    }
  }

  private handlePlayerMove(
    roomId: string,
    socketId: string,
    direction: "up" | "down" | "stop",
    paddleIndex?: number
  ) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameState !== "playing") return;

    // For local/AI modes, use paddleIndex to determine which paddle to move
    let player: Player | undefined;
    if (
      paddleIndex !== undefined &&
      (room.gameMode === "local" || room.gameMode === "ai")
    ) {
      // Use paddleIndex to select the player (0 = left paddle, 1 = right paddle)
      player = room.players[paddleIndex];
    } else {
      // Normal mode - find player by socket ID
      player = room.players.find((p) => p.socketId === socketId);
    }

    if (!player) return;

    // Use GameEngine to handle player input
    const engine = this.gameEngines.get(roomId);
    if (engine) {
      // Send input to GameEngine using the player's ID
      engine.handlePlayerInput(player.id, direction);
    } else {
      // Fallback for rooms without engine (shouldn't happen in normal flow)
      if (direction === "up") {
        player.paddle.y = Math.max(0, player.paddle.y - player.paddle.speed);
      } else if (direction === "down") {
        player.paddle.y = Math.min(
          room.gameSettings.height - GAME_CONSTANTS.PADDLE_HEIGHT,
          player.paddle.y + player.paddle.speed
        );
      }
    }
  }

  private startGameLoop(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Clear any existing game loop for this room
    const existingLoop = this.gameLoops.get(roomId);
    if (existingLoop) {
      clearInterval(existingLoop);
    }

    // Clear any existing GameEngine
    const existingEngine = this.gameEngines.get(roomId);
    if (existingEngine) {
      existingEngine.stop();
      this.gameEngines.delete(roomId);
    }

    // Create GameEngine settings from room settings
    const engineSettings: EngineGameSettings = {
      width: room.gameSettings.width,
      height: room.gameSettings.height,
      paddleWidth: room.gameSettings.paddleWidth,
      paddleHeight: room.gameSettings.paddleHeight,
      paddleSpeed: room.gameSettings.paddleSpeed,
      ballRadius: room.gameSettings.ballSize / 2, // Convert ballSize to radius
      ballSpeed: room.gameSettings.ballSpeed,
      maxScore: room.gameSettings.maxScore,
    };

    // Create engine events
    const engineEvents = {
      onScore: (player: 1 | 2, score1: number, score2: number) => {
        console.log(`🎯 onScore called for room ${roomId}:`, {
          player,
          score1,
          score2,
          gameMode: room.gameMode,
          timestamp: Date.now(),
        });

        // Update room scores
        if (room.players[0]) room.players[0].score = score1;
        if (room.players[1]) room.players[1].score = score2;

        // Broadcast score event
        const scorer =
          player === 1 ? room.players[0]?.username : room.players[1]?.username;
        console.log(`📡 Emitting 'score' event to room ${roomId}:`, {
          leftScore: score1,
          rightScore: score2,
          scorer,
        });
        this.io.to(roomId).emit("score", {
          leftScore: score1,
          rightScore: score2,
          scorer,
        });
      },
      onGameEnd: (winner: string, score1: number, score2: number) => {
        // End the game
        this.endGame(roomId);
      },
      onCountdown: (count: number) => {
        // Broadcast countdown to all clients in the room
        console.log(`⏱️  Broadcasting countdown ${count} to room ${roomId}`);
        this.io.to(roomId).emit("countdown", count);
      },
      onStateUpdate: (state: any) => {
        // Broadcast game state to all clients in the room
        const player1Data = state.players.find(
          (p: any) => p.id === room.players[0]?.id
        );
        const player2Data = state.players.find(
          (p: any) => p.id === room.players[1]?.id
        );

        this.io.to(roomId).emit("gameUpdate", {
          ball: {
            x: state.ball.x,
            y: state.ball.y,
            vx: state.ball.velocityX,
            vy: state.ball.velocityY,
          },
          players: [
            {
              id: room.players[0]?.id,
              paddle: { y: player1Data?.paddle.y || 0 },
              score: player1Data?.score || 0,
            },
            {
              id: room.players[1]?.id,
              paddle: { y: player2Data?.paddle.y || 0 },
              score: player2Data?.score || 0,
            },
          ],
        });

        // Also update room state for consistency
        room.ball.x = state.ball.x;
        room.ball.y = state.ball.y;
        room.ball.vx = state.ball.velocityX;
        room.ball.vy = state.ball.velocityY;
        if (room.players[0] && player1Data)
          room.players[0].paddle.y = player1Data.paddle.y;
        if (room.players[1] && player2Data)
          room.players[1].paddle.y = player2Data.paddle.y;
      },
    };

    // Create new GameEngine instance
    const engine = new GameEngine(engineSettings, engineEvents, 60);

    // Set player information
    if (room.players[0]) {
      engine.setPlayer1(
        room.players[0].id,
        room.players[0].userId,
        room.players[0].username
      );
    }
    if (room.players[1]) {
      engine.setPlayer2(
        room.players[1].id,
        room.players[1].userId,
        room.players[1].username
      );
    }

    // Enable AI if this is an AI game
    if (room.gameMode === "ai") {
      const difficulty = room.aiDifficulty || "medium";
      engine.enableAI(difficulty);
      console.log(
        `🤖 AI enabled for room ${roomId} with ${difficulty} difficulty`
      );
    }

    // Start the game engine
    engine.start();
    this.gameEngines.set(roomId, engine);

    console.log(`🎮 Started GameEngine for room ${roomId} at 60 FPS`);
  }

  // DEPRECATED: Old game loop - now using GameEngine
  // This function is kept for backward compatibility but should not be called
  private updateGameState(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameState !== "playing") return;

    // Check if using new GameEngine
    const engine = this.gameEngines.get(roomId);
    if (engine) {
      console.warn(
        `⚠️ updateGameState called for room ${roomId} but using GameEngine - this should not happen`
      );
      return;
    }

    // Legacy fallback code (should not be reached)
    console.warn(`⚠️ Using legacy game loop for room ${roomId}`);

    // Ensure we have 2 players before running game logic
    if (room.players.length !== 2) {
      console.log(
        `⚠️ Room ${roomId} doesn't have 2 players, pausing game logic`
      );
      return;
    }

    // Update ball position
    room.ball.x += room.ball.vx;
    room.ball.y += room.ball.vy;

    // Ball collision with walls (top and bottom)
    if (room.ball.y <= 10 || room.ball.y >= room.gameSettings.height - 10) {
      room.ball.vy = -room.ball.vy;
    }

    // Ball collision with paddles
    const leftPlayer = room.players[0];
    const rightPlayer = room.players[1];
    const paddleWidth = GAME_CONSTANTS.PADDLE_WIDTH;
    const paddleHeight = GAME_CONSTANTS.PADDLE_HEIGHT;

    // Left paddle collision (improved detection)
    if (
      room.ball.x <= 20 + paddleWidth &&
      room.ball.x >= 10 &&
      room.ball.y >= leftPlayer.paddle.y - 10 &&
      room.ball.y <= leftPlayer.paddle.y + paddleHeight + 10 &&
      room.ball.vx < 0
    ) {
      room.ball.vx = Math.abs(room.ball.vx);
      // Add spin based on where ball hits paddle
      const hitPos = (room.ball.y - leftPlayer.paddle.y) / paddleHeight;
      room.ball.vy += (hitPos - 0.5) * 3;
    }

    // Right paddle collision (improved detection)
    if (
      room.ball.x >= room.gameSettings.width - 20 - paddleWidth &&
      room.ball.x <= room.gameSettings.width - 10 &&
      room.ball.y >= rightPlayer.paddle.y - 10 &&
      room.ball.y <= rightPlayer.paddle.y + paddleHeight + 10 &&
      room.ball.vx > 0
    ) {
      room.ball.vx = -Math.abs(room.ball.vx);
      // Add spin based on where ball hits paddle
      const hitPos = (room.ball.y - rightPlayer.paddle.y) / paddleHeight;
      room.ball.vy += (hitPos - 0.5) * 3;
    }

    // Scoring (ball goes off screen)
    if (room.ball.x <= 0) {
      rightPlayer.score++;
      this.resetBall(room);
      this.io.to(roomId).emit("score", {
        leftScore: leftPlayer.score,
        rightScore: rightPlayer.score,
        scorer: rightPlayer.username,
      });
    } else if (room.ball.x >= room.gameSettings.width) {
      leftPlayer.score++;
      this.resetBall(room);
      this.io.to(roomId).emit("score", {
        leftScore: leftPlayer.score,
        rightScore: rightPlayer.score,
        scorer: leftPlayer.username,
      });
    }

    // Check for game end
    if (
      leftPlayer.score >= room.gameSettings.maxScore ||
      rightPlayer.score >= room.gameSettings.maxScore
    ) {
      this.endGame(roomId);
      return;
    }

    // Update room timestamp
    room.lastUpdate = new Date();

    // Optimize: Send minimal game state to reduce network load
    this.io.to(roomId).emit("gameUpdate", {
      ball: {
        x: Math.round(room.ball.x * 10) / 10, // Round to 1 decimal place
        y: Math.round(room.ball.y * 10) / 10,
        vx: Math.round(room.ball.vx * 10) / 10,
        vy: Math.round(room.ball.vy * 10) / 10,
      },
      players: room.players.map((p) => ({
        id: p.id,
        paddle: {
          y: Math.round(p.paddle.y * 10) / 10, // Round paddle positions
        },
        score: p.score,
      })),
    });
  }

  private resetBall(room: GameRoom) {
    room.ball.x = room.gameSettings.width / 2;
    room.ball.y = room.gameSettings.height / 2;
    // Ensure ball has proper speed and direction
    const direction = room.ball.vx > 0 ? -1 : 1;
    room.ball.vx = direction * room.ball.speed;
    room.ball.vy = (Math.random() - 0.5) * room.ball.speed * 0.8; // Reduce vertical randomness
  }

  private endGame(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Clean up old game loop (if any)
    const gameLoop = this.gameLoops.get(roomId);
    if (gameLoop) {
      clearInterval(gameLoop);
      this.gameLoops.delete(roomId);
    }

    // Clean up GameEngine
    const engine = this.gameEngines.get(roomId);
    if (engine) {
      engine.destroy();
      this.gameEngines.delete(roomId);
      console.log(`🧹 Cleaned up GameEngine for room ${roomId}`);
    }

    room.gameState = "finished";
    const winner = room.players.find(
      (p) => p.score >= room.gameSettings.maxScore
    );

    if (winner) {
      room.winner = winner.username;
      // Handle tournament match completion
      if (room.tournamentMatch && room.tournamentId && room.matchId) {
        console.log(
          `🏆 Tournament match completed: ${room.matchId}, winner: ${winner.username}`
        );
        // Save tournament match result to database with game_type = 'tournament'
        this.saveTournamentMatchResult(room);
        // Handle tournament bracket progression
        this.handleTournamentMatchResult(
          room.tournamentId,
          room.matchId,
          winner.id
        );
      } else {
        // Regular game - save to database (but not for local/AI modes with virtual players)
        const hasVirtualPlayer = room.players.some((p) =>
          p.id.startsWith("virtual_")
        );
        if (!hasVirtualPlayer && room.players.length === 2) {
          this.saveGameResult(room);
        } else {
          console.log(
            `⏭️ Skipping game result save for ${
              room.gameMode || "local/ai"
            } mode`
          );
        }
      }

      // Build final score safely
      const finalScore: Record<string, number> = {};
      if (room.players[0]) {
        finalScore[room.players[0].username] = room.players[0].score;
      }
      if (room.players[1]) {
        finalScore[room.players[1].username] = room.players[1].score;
      }

      this.io.to(roomId).emit("gameEnd", {
        winner: winner.username,
        finalScore,
      });
    }

    // Clean up room after 30 seconds
    setTimeout(() => {
      this.cleanupRoom(roomId);
    }, 30000);

    console.log(`🏆 Game ended in room ${roomId}. Winner: ${winner?.username}`);
  }

  private saveGameResult(room: GameRoom) {
    try {
      const player1 = room.players[0];
      const player2 = room.players[1];

      // Insert match history
      const stmt = db.prepare(`
        INSERT INTO match_history (player1_id, player2_id, player1_score, player2_score, winner_id, game_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const winnerId =
        player1.score > player2.score ? player1.userId : player2.userId;

      stmt.run(
        player1.userId,
        player2.userId,
        player1.score,
        player2.score,
        winnerId,
        new Date().toISOString()
      );

      // Update player stats
      const updateStats = db.prepare(`
        UPDATE user_stats
        SET total_games = total_games + 1,
            wins = wins + ?,
            losses = losses + ?
        WHERE user_id = ?
      `);

      updateStats.run(
        player1.score > player2.score ? 1 : 0,
        player1.score < player2.score ? 1 : 0,
        player1.userId
      );
      updateStats.run(
        player2.score > player1.score ? 1 : 0,
        player2.score < player1.score ? 1 : 0,
        player2.userId
      );

      console.log(`💾 Game result saved for room ${room.id}`);
    } catch (error) {
      console.error("Error saving game result:", error);
    }
  }

  private saveTournamentMatchResult(room: GameRoom) {
    try {
      const player1 = room.players[0];
      const player2 = room.players[1];

      if (!player1 || !player2) {
        console.error("❌ Cannot save tournament match: missing players");
        return;
      }

      // Skip if any player is virtual (AI)
      if (
        player1.id.startsWith("virtual_") ||
        player2.id.startsWith("virtual_")
      ) {
        console.log(
          `⏭️ Skipping tournament match save: virtual player detected`
        );
        return;
      }

      // Insert match history with game_type = 'tournament'
      const stmt = db.prepare(`
				INSERT INTO match_history (player1_id, player2_id, player1_score, player2_score, winner_id, game_date, game_type)
				VALUES (?, ?, ?, ?, ?, ?, 'tournament')
			`);

      const winnerId =
        player1.score > player2.score ? player1.userId : player2.userId;

      stmt.run(
        player1.userId,
        player2.userId,
        player1.score,
        player2.score,
        winnerId,
        new Date().toISOString()
      );

      console.log(
        `💾 Tournament match saved: ${player1.username} (${player1.score}) vs ${player2.username} (${player2.score})`
      );

      // Ensure user_stats exist for both players, then update
      const ensureStats = db.prepare(`
				INSERT OR IGNORE INTO user_stats (user_id, total_games, wins, losses)
				VALUES (?, 0, 0, 0)
			`);
      ensureStats.run(player1.userId);
      ensureStats.run(player2.userId);

      // Update player stats for both players
      const updateStats = db.prepare(`
				UPDATE user_stats
				SET total_games = total_games + 1,
					wins = wins + ?,
					losses = losses + ?
				WHERE user_id = ?
			`);

      // Update player 1 stats
      const player1Won = player1.score > player2.score ? 1 : 0;
      const player1Lost = player1.score < player2.score ? 1 : 0;
      updateStats.run(player1Won, player1Lost, player1.userId);
      console.log(
        `📊 Updated stats for ${player1.username}: +1 game, ${
          player1Won ? "+1 win" : "+1 loss"
        }`
      );

      // Update player 2 stats
      const player2Won = player2.score > player1.score ? 1 : 0;
      const player2Lost = player2.score < player1.score ? 1 : 0;
      updateStats.run(player2Won, player2Lost, player2.userId);
      console.log(
        `📊 Updated stats for ${player2.username}: +1 game, ${
          player2Won ? "+1 win" : "+1 loss"
        }`
      );
    } catch (error) {
      console.error("❌ Error saving tournament match result:", error);
    }
  }

  private handlePlayerLeave(socketId: string) {
    const roomId = this.playerToRoom.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    // Find the player to get their userId
    const leavingPlayer = room.players.find((p) => p.socketId === socketId);
    const userId = leavingPlayer?.userId;

    // Remove ALL entries for this player (by both socket ID and user ID)
    // This prevents duplicates when a user reconnects with a new socket
    room.players = room.players.filter((p) => {
      if (p.socketId === socketId) return false;
      if (userId && p.userId === userId) return false;
      return true;
    });
    this.playerToRoom.delete(socketId);

    // If game was in progress, end it
    if (room.gameState === "playing") {
      const gameLoop = this.gameLoops.get(roomId);
      if (gameLoop) {
        clearInterval(gameLoop);
        this.gameLoops.delete(roomId);
      }

      this.io.to(roomId).emit("playerLeft", {
        message: "Opponent left the game",
        remaining: room.players.length,
      });
    }

    // Clean up empty room
    if (room.players.length === 0) {
      this.cleanupRoom(roomId);
    } else {
      // Notify remaining players
      this.io.to(roomId).emit("playerLeft", {
        players: room.players.map((p) => ({
          id: p.id,
          username: p.username,
          score: p.score,
          ready: p.ready,
        })),
        gameState: room.gameState,
      });
    }
  }

  private cleanupStalePlayerEntries(userId: number) {
    // Remove any stale entries for this user from all rooms
    // This happens when a user disconnects and their socket is removed from userSockets,
    // but they might still have entries in rooms
    for (const [roomId, room] of this.rooms.entries()) {
      const stalePlayers = room.players.filter((p) => p.userId === userId);
      if (stalePlayers.length > 0) {
        console.log(
          `🧹 Cleaning up ${stalePlayers.length} stale entries for user ${userId} from room ${roomId}`
        );

        // Remove stale players
        room.players = room.players.filter((p) => p.userId !== userId);

        // Clean up their socket mappings
        for (const stalePlayer of stalePlayers) {
          this.playerToRoom.delete(stalePlayer.socketId);
        }

        // Clean up empty room
        if (room.players.length === 0) {
          this.cleanupRoom(roomId);
        }
      }
    }
  }

  private handleJoinSpecificRoom(roomId: string, socket: any) {
    const room = this.rooms.get(roomId);
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("error", "Room is full");
      return;
    }

    if (room.gameState !== "waiting") {
      socket.emit("error", "Game already in progress");
      return;
    }

    // Join the specific room
    this.joinRoom(roomId, socket);
    socket.emit("gameFound", { roomId });
  }

  private handleSpectatorJoin(roomId: string, socket: any) {
    const room = this.rooms.get(roomId);
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    // Check if already spectating
    const alreadySpectating = room.spectators.find(
      (s) => s.socketId === socket.id
    );
    if (alreadySpectating) return;

    const spectator = {
      id: socket.data.user.id.toString(),
      userId: socket.data.user.id,
      username: socket.data.user.username,
      socketId: socket.id,
    };

    room.spectators.push(spectator);
    socket.join(roomId);
    this.playerToRoom.set(socket.id, roomId); // Reuse the same map for spectators

    // Notify spectator about current game state
    socket.emit("spectatorJoined", {
      roomId,
      gameState: room.gameState,
      players: room.players.map((p) => ({
        id: p.id,
        username: p.username,
        score: p.score,
      })),
      ball: room.ball,
    });

    // Notify room about new spectator
    this.io.to(roomId).emit("spectatorJoined", {
      username: spectator.username,
      spectatorCount: room.spectators.length,
    });

    console.log(`👁️ Spectator ${spectator.username} joined room ${roomId}`);
  }

  private handleSpectatorLeave(socketId: string) {
    const roomId = this.playerToRoom.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const spectatorIndex = room.spectators.findIndex(
      (s) => s.socketId === socketId
    );
    if (spectatorIndex === -1) return;

    const spectator = room.spectators[spectatorIndex];
    room.spectators.splice(spectatorIndex, 1);
    this.playerToRoom.delete(socketId);

    // Notify room about spectator leaving
    this.io.to(roomId).emit("spectatorLeft", {
      username: spectator.username,
      spectatorCount: room.spectators.length,
    });

    console.log(`👁️ Spectator ${spectator.username} left room ${roomId}`);
  }

  private cleanupRoom(roomId: string) {
    // Clean up old game loop (if any)
    const gameLoop = this.gameLoops.get(roomId);
    if (gameLoop) {
      clearInterval(gameLoop);
      this.gameLoops.delete(roomId);
    }

    // Clean up GameEngine
    const engine = this.gameEngines.get(roomId);
    if (engine) {
      engine.destroy();
      this.gameEngines.delete(roomId);
      console.log(`🧹 Cleaned up GameEngine for room ${roomId}`);
    }

    // Clean up all player and spectator references
    const room = this.rooms.get(roomId);
    if (room) {
      room.players.forEach((p) => this.playerToRoom.delete(p.socketId));
      room.spectators.forEach((s) => this.playerToRoom.delete(s.socketId));
    }

    // Clean up room code if it exists
    for (const [code, rid] of this.roomCodes.entries()) {
      if (rid === roomId) {
        this.roomCodes.delete(code);
        console.log(`🗑️ Removed room code ${code} for room ${roomId}`);
        break;
      }
    }

    this.rooms.delete(roomId);
    console.log(`🧹 Cleaned up room ${roomId}`);
  }

  private generateRoomCode(): string {
    // Generate a 6-character room code
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude similar looking characters
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    // Check if code already exists, regenerate if it does
    if (this.roomCodes.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }

  private handleCreatePrivateRoom(
    socket: any,
    data?: {
      gameMode?: "online" | "local" | "ai";
      aiDifficulty?: "easy" | "medium" | "hard";
    }
  ) {
    const gameMode = data?.gameMode || "online";
    const aiDifficulty = data?.aiDifficulty || "medium";
    console.log(
      `🔒 Player ${socket.data.user?.username} attempting to create private room (mode: ${gameMode}, difficulty: ${aiDifficulty})`
    );

    // Check if player is already in a room - if so, leave it first
    const existingRoomId = this.playerToRoom.get(socket.id);
    if (existingRoomId) {
      console.log(
        `⚠️ Player already in room ${existingRoomId}, leaving it first`
      );
      this.handlePlayerLeave(socket.id);
    }

    // Generate unique room code
    const roomCode = this.generateRoomCode();
    const roomId = `private_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create the room
    this.createRoom(roomId, socket);

    // Set the game mode and AI difficulty
    const room = this.rooms.get(roomId);
    if (room) {
      room.gameMode = gameMode;
      room.aiDifficulty = aiDifficulty;
    }

    // Map code to room ID
    this.roomCodes.set(roomCode, roomId);

    // Send room code to creator
    socket.emit("privateRoomCreated", {
      roomCode,
      roomId,
    });

    console.log(
      `🔒 Created private room ${roomId} with code ${roomCode} for ${socket.data.user.username} (mode: ${gameMode}, difficulty: ${aiDifficulty})`
    );
  }

  private handleJoinRoomByCode(socket: any, code: string) {
    console.log(
      `🔑 Player ${socket.data.user?.username} attempting to join room with code: ${code}`
    );

    // Check if player is already in a room - if so, leave it first
    const existingRoomId = this.playerToRoom.get(socket.id);
    if (existingRoomId) {
      console.log(
        `⚠️ Player already in room ${existingRoomId}, leaving it first`
      );
      this.handlePlayerLeave(socket.id);
    }

    // Look up room ID from code
    const roomId = this.roomCodes.get(code.toUpperCase());
    if (!roomId) {
      socket.emit("roomNotFound", { code });
      console.log(`❌ Room code not found: ${code}`);
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      // Room no longer exists, clean up the code
      this.roomCodes.delete(code.toUpperCase());
      socket.emit("roomNotFound", { code });
      console.log(`❌ Room ${roomId} no longer exists for code ${code}`);
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("error", "Room is full");
      return;
    }

    if (room.gameState !== "waiting") {
      socket.emit("error", "Game already in progress");
      return;
    }

    // Join the room
    this.joinRoom(roomId, socket);
    socket.emit("roomJoined", { roomId, code });
    console.log(
      `✅ Player ${socket.data.user.username} joined room ${roomId} using code ${code}`
    );
  }

  public getStats() {
    return {
      activeRooms: this.rooms.size,
      activePlayers: this.playerToRoom.size,
      gameLoops: this.gameLoops.size,
    };
  }

  // Emit event to a specific user by userId
  public emitToUser(userId: number, event: string, data: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      console.log(
        `📤 Emitted ${event} to user ${userId} (socket: ${socketId})`
      );
      return true;
    }
    console.log(`⚠️ User ${userId} not connected`);
    return false;
  }

  // Get online status of a user
  public isUserOnline(userId: number): boolean {
    return this.userSockets.has(userId);
  }

  // Get list of online users
  public getOnlineUsers(): number[] {
    return Array.from(this.userSockets.keys());
  }

  // Notify friends when user's online status changes
  public async emitGameResult(result: {
    gameId: number;
    playerId: number;
    opponentId: number | null;
    playerScore: number;
    opponentScore: number;
    won: boolean;
  }) {
    if (!this.options.onGameResult) {
      return;
    }

    const event: GameResultEvent = {
      gameId: result.gameId,
      playerId: result.playerId,
      opponentId: result.opponentId,
      playerScore: result.playerScore,
      opponentScore: result.opponentScore,
      won: result.won,
      recordedAt: new Date().toISOString(),
    };

    try {
      await this.options.onGameResult(event);
    } catch (error) {
      console.error("Failed to emit game result event", error);
    }
  }

  private async notifyPresence(update: {
    userId: number;
    username: string;
    status: "online" | "offline";
  }) {
    if (!this.options.onPresenceChange) {
      return;
    }

    const event: PresenceStatusEvent = {
      userId: update.userId,
      username: update.username,
      status: update.status,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.options.onPresenceChange(event);
    } catch (error) {
      console.error("Failed to emit presence event", error);
    }
  }

  private notifyFriendsOnlineStatus(userId: number, isOnline: boolean) {
    try {
      // Get user's friends
      const friends = db
        .prepare(
          `
				SELECT friend_id FROM friends WHERE user_id = ?
			`
        )
        .all(userId) as Array<{ friend_id: number }>;

      // Get user info for notification
      const user = db
        .prepare("SELECT id, username, display_name FROM users WHERE id = ?")
        .get(userId) as any;

      if (!user) return;

      // Notify each friend
      friends.forEach(({ friend_id }) => {
        this.emitToUser(friend_id, "friendStatusChanged", {
          user_id: user.id,
          username: user.username,
          display_name: user.display_name,
          is_online: isOnline,
        });
      });

      console.log(
        `📢 Notified ${friends.length} friends that ${user.username} is ${
          isOnline ? "online" : "offline"
        }`
      );
    } catch (error) {
      console.error("Error notifying friends of online status:", error);
    }
  }

  // ================================
  // TOURNAMENT MANAGEMENT METHODS
  // ================================

  private handleCreateTournament(
    socket: any,
    data: { name: string; size: number; matchType: number }
  ) {
    const { name, size, matchType } = data;

    // Validate tournament size (must be power of 2)
    if (![4, 8, 16].includes(size)) {
      socket.emit("error", "Tournament size must be 4, 8, or 16 players");
      return;
    }

    const tournamentId = `tournament_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const joinCode = this.generateJoinCode();

    const tournament: Tournament = {
      id: tournamentId,
      name: name || `${socket.data.user.username}'s Tournament`,
      creatorId: socket.data.user.id,
      joinCode,
      players: [
        {
          id: socket.data.user.id.toString(),
          userId: socket.data.user.id,
          username: socket.data.user.username,
          socketId: socket.id,
          isAI: false,
          eliminated: false,
        },
      ],
      matches: [],
      rounds: Math.log2(size),
      currentRound: 1,
      size,
      gameMode: "remote",
      matchType,
      completed: false,
      winner: null,
      createdAt: new Date(),
      status: "setup",
      spectators: [],
    };

    this.tournaments.set(tournamentId, tournament);
    this.joinCodeToTournament.set(joinCode, tournamentId);
    this.playerToTournament.set(socket.data.user.id, tournamentId);

    socket.emit("tournamentCreated", {
      tournament: this.getTournamentSafeData(tournament),
    });

    console.log(
      `🏆 Tournament ${tournamentId} created by ${socket.data.user.username}`
    );
  }

  private handleJoinTournament(
    socket: any,
    tournamentId?: string,
    joinCode?: string
  ) {
    let resolvedTournamentId: string | undefined = tournamentId;
    let tournament: Tournament | undefined;

    if (resolvedTournamentId) {
      tournament = this.tournaments.get(resolvedTournamentId);
    }

    if (!tournament && joinCode) {
      const normalizedCode = joinCode.trim().toUpperCase();
      const mappedId = this.joinCodeToTournament.get(normalizedCode);
      if (mappedId) {
        resolvedTournamentId = mappedId;
        tournament = this.tournaments.get(mappedId);
      }
    }

    if (!tournament || !resolvedTournamentId) {
      socket.emit("error", "Tournament not found");
      return;
    }

    if (tournament.status !== "setup") {
      socket.emit("error", "Tournament already started");
      return;
    }

    // Check if player is already in tournament (allow rejoin)
    const existingPlayer = tournament.players.find(
      (p) => p.userId === socket.data.user.id
    );
    if (existingPlayer) {
      // Update socket ID for reconnection
      existingPlayer.socketId = socket.id;
      this.playerToTournament.set(socket.data.user.id, resolvedTournamentId);

      socket.emit("tournamentJoined", {
        tournament: this.getTournamentSafeData(tournament),
      });
      console.log(
        `🔄 Player ${socket.data.user.username} rejoined tournament ${resolvedTournamentId}`
      );
      return;
    }

    // Check if tournament is full (after checking existing player)
    if (tournament.players.length >= tournament.size) {
      socket.emit("error", "Tournament is full");
      return;
    }

    // Add player to tournament
    tournament.players.push({
      id: socket.data.user.id.toString(),
      userId: socket.data.user.id,
      username: socket.data.user.username,
      socketId: socket.id,
      isAI: false,
      eliminated: false,
    });

    this.playerToTournament.set(socket.data.user.id, resolvedTournamentId);

    // Notify all tournament participants
    this.broadcastToTournament(resolvedTournamentId, "tournamentPlayerJoined", {
      player: {
        id: socket.data.user.id.toString(),
        username: socket.data.user.username,
      },
      tournament: this.getTournamentSafeData(tournament),
    });
    this.broadcastTournamentState(resolvedTournamentId);

    socket.emit("tournamentJoined", {
      tournament: this.getTournamentSafeData(tournament),
    });

    console.log(
      `🏆 Player ${socket.data.user.username} joined tournament ${resolvedTournamentId} (${tournament.players.length}/${tournament.size})`
    );
  }

  private handleLeaveTournament(socket: any) {
    const tournamentId = this.playerToTournament.get(socket.data.user.id);

    if (!tournamentId) {
      socket.emit("error", "Not in any tournament");
      return;
    }

    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      this.playerToTournament.delete(socket.data.user.id);
      return;
    }

    if (tournament.status === "active") {
      socket.emit("error", "Cannot leave tournament after it has started");
      return;
    }

    // Remove player from tournament
    tournament.players = tournament.players.filter(
      (p) => p.userId !== socket.data.user.id
    );
    this.playerToTournament.delete(socket.data.user.id);

    // If creator left and tournament is in setup, delete tournament
    if (
      tournament.creatorId === socket.data.user.id &&
      tournament.status === "setup"
    ) {
      this.deleteTournament(tournamentId);
      return;
    }

    // Notify remaining players
    this.broadcastToTournament(tournamentId, "tournamentPlayerLeft", {
      playerId: socket.data.user.id.toString(),
      tournament: this.getTournamentSafeData(tournament),
    });
    this.broadcastTournamentState(tournamentId);

    socket.emit("tournamentLeft");
    console.log(
      `🏆 Player ${socket.data.user.username} left tournament ${tournamentId}`
    );
  }

  private handleStartTournament(socket: any, tournamentId: string) {
    const tournament = this.tournaments.get(tournamentId);

    if (!tournament) {
      socket.emit("error", "Tournament not found");
      return;
    }

    if (tournament.creatorId !== socket.data.user.id) {
      socket.emit("error", "Only tournament creator can start tournament");
      return;
    }

    if (tournament.players.length !== tournament.size) {
      socket.emit(
        "error",
        `Tournament needs ${tournament.size} players to start`
      );
      return;
    }

    if (tournament.status !== "setup") {
      socket.emit("error", "Tournament already started");
      return;
    }

    // Generate tournament bracket
    this.generateTournamentBracket(tournament);
    tournament.status = "active";

    // Notify all participants
    this.broadcastToTournament(tournamentId, "tournamentStarted", {
      tournament: this.getTournamentSafeData(tournament),
    });
    this.broadcastTournamentState(tournamentId);

    console.log(
      `🏆 Tournament ${tournamentId} started with ${tournament.players.length} players`
    );
  }

  private handleTournamentMatchReady(
    socket: any,
    tournamentId: string,
    matchId: string
  ) {
    const tournament = this.tournaments.get(tournamentId);

    if (!tournament) {
      socket.emit("error", "Tournament not found");
      return;
    }

    const match = tournament.matches.find((m) => m.id === matchId);
    if (!match) {
      socket.emit("error", "Match not found");
      return;
    }

    // Check if user is a participant in this match
    const isParticipant =
      match.player1?.userId === socket.data.user.id ||
      match.player2?.userId === socket.data.user.id;

    if (!isParticipant) {
      socket.emit("error", "You are not a participant in this match");
      return;
    }

    // Create game room for this tournament match if needed
    if (!match.roomId) {
      const roomId = `tournament_${tournamentId}_match_${matchId}`;
      this.createTournamentMatchRoom(roomId, tournament, match);
      match.roomId = roomId;
      match.gameInProgress = false; // Reset game in progress flag
    }

    const room = match.roomId ? this.rooms.get(match.roomId) : null;
    if (!room) {
      socket.emit("error", "Failed to create match room");
      return;
    }

    // Set allowed players for tournament match
    const allowed: number[] = [];
    if (match.player1?.userId) allowed.push(match.player1.userId);
    if (match.player2?.userId) allowed.push(match.player2.userId);
    room.allowedPlayers = allowed;

    // Update socket IDs for match participants
    if (match.player1 && match.player1.userId === socket.data.user.id) {
      match.player1.socketId = socket.id;
    }
    if (match.player2 && match.player2.userId === socket.data.user.id) {
      match.player2.socketId = socket.id;
    }

    // Mark that this match is in progress (waiting for players to join)
    match.gameInProgress = true;

    // Always send event to the requesting player
    socket.emit("tournamentMatchStarted", {
      matchId,
      roomId: match.roomId,
      tournament: this.getTournamentSafeData(tournament),
    });

    // Also notify the OTHER match participant about room being ready
    // Send to player1 (if they're not the requester)
    if (match.player1?.socketId && match.player1.socketId !== socket.id) {
      this.io.to(match.player1.socketId).emit("tournamentMatchStarted", {
        matchId,
        roomId: match.roomId,
        tournament: this.getTournamentSafeData(tournament),
      });
    }

    // Send to player2 (if they're not the requester)
    if (match.player2?.socketId && match.player2.socketId !== socket.id) {
      this.io.to(match.player2.socketId).emit("tournamentMatchStarted", {
        matchId,
        roomId: match.roomId,
        tournament: this.getTournamentSafeData(tournament),
      });
    }

    // Update tournament state for spectators
    this.broadcastTournamentState(tournamentId);

    console.log(
      `🏆 Tournament match ${matchId} ready signal sent to ${socket.data.user.username}, room: ${match.roomId}`
    );
  }

  private handleTournamentMatchResult(
    tournamentId: string,
    matchId: string,
    winnerId: string
  ) {
    const tournament = this.tournaments.get(tournamentId);

    if (!tournament) {
      console.error(`Tournament ${tournamentId} not found for match result`);
      return;
    }

    const match = tournament.matches.find((m) => m.id === matchId);
    if (!match) {
      console.error(`Match ${matchId} not found in tournament ${tournamentId}`);
      return;
    }

    // Set match winner
    const winner =
      match.player1?.id === winnerId ? match.player1 : match.player2;
    if (!winner) {
      console.error(`Winner ${winnerId} not found in match ${matchId}`);
      return;
    }

    match.winner = winner;
    match.completed = true;
    match.gameInProgress = false;

    // Advance winner to next round
    this.advanceTournamentWinner(tournament, match);
    this.updateTournamentRound(tournament);

    // Check if tournament is complete
    if (this.checkTournamentComplete(tournament)) {
      tournament.completed = true;
      tournament.status = "completed";
      tournament.winner = this.getFinalWinner(tournament);

      this.broadcastToTournament(tournamentId, "tournamentCompleted", {
        winner: tournament.winner,
        tournament: this.getTournamentSafeData(tournament),
      });
    } else {
      // Notify about match result and updated bracket
      this.broadcastToTournament(tournamentId, "tournamentMatchCompleted", {
        matchId,
        winnerId,
        tournament: this.getTournamentSafeData(tournament),
      });
    }

    this.broadcastTournamentState(tournamentId);

    console.log(
      `🏆 Tournament ${tournamentId} match ${matchId} completed, winner: ${winner.username}`
    );
  }

  private handleSpectateTournament(socket: any, tournamentId: string) {
    const tournament = this.tournaments.get(tournamentId);

    if (!tournament) {
      socket.emit("error", "Tournament not found");
      return;
    }

    // Add to spectators if not already spectating
    const existingSpectator = tournament.spectators.find(
      (s) => s.userId === socket.data.user.id
    );
    if (!existingSpectator) {
      tournament.spectators.push({
        userId: socket.data.user.id,
        username: socket.data.user.username,
        socketId: socket.id,
      });
    } else {
      existingSpectator.socketId = socket.id; // Update socket ID
    }

    socket.emit("tournamentSpectating", {
      tournament: this.getTournamentSafeData(tournament),
    });

    console.log(
      `🏆 Player ${socket.data.user.username} is now spectating tournament ${tournamentId}`
    );
  }

  private handleListTournaments(socket: any) {
    const tournamentList = Array.from(this.tournaments.values())
      .filter((t) => t.status === "setup" || t.status === "active")
      .map((t) => ({
        id: t.id,
        joinCode: t.joinCode,
        name: t.name,
        creatorUsername:
          t.players.find((p) => p.userId === t.creatorId)?.username ||
          "Unknown",
        playerCount: t.players.length,
        maxPlayers: t.size,
        gameMode: t.gameMode,
        status: t.status,
        canJoin: t.status === "setup" && t.players.length < t.size,
      }));

    socket.emit("tournamentList", { tournaments: tournamentList });
  }

  private handleInviteToTournament(
    socket: any,
    tournamentId: string,
    friendId: number
  ) {
    const tournament = this.tournaments.get(tournamentId);

    if (!tournament) {
      socket.emit("error", "Tournament not found");
      return;
    }

    if (tournament.creatorId !== socket.data.user.id) {
      socket.emit("error", "Only tournament creator can invite players");
      return;
    }

    if (tournament.status !== "setup") {
      socket.emit("error", "Cannot invite to tournament after it has started");
      return;
    }

    // Send invitation
    this.emitToUser(friendId, "tournamentInvitation", {
      tournamentId,
      tournamentName: tournament.name,
      inviterUsername: socket.data.user.username,
      joinCode: tournament.joinCode,
    });

    socket.emit("tournamentInvitationSent", { friendId });
    console.log(
      `🏆 Tournament invitation sent from ${socket.data.user.username} to user ${friendId}`
    );
  }

  private handleAcceptTournamentInvite(socket: any, tournamentId: string) {
    // This is the same as joining a tournament
    this.handleJoinTournament(socket, tournamentId);
  }

  // Helper methods for tournament management

  private getTournamentSafeData(tournament: Tournament) {
    return {
      id: tournament.id,
      name: tournament.name,
      creatorId: tournament.creatorId,
      joinCode: tournament.joinCode,
      players: tournament.players.map((p) => ({
        id: p.id,
        username: p.username,
        isAI: p.isAI,
        eliminated: p.eliminated,
      })),
      matches: tournament.matches.map((m) => ({
        id: m.id,
        player1: m.player1
          ? {
              id: m.player1.id,
              username: m.player1.username,
              isAI: m.player1.isAI,
            }
          : null,
        player2: m.player2
          ? {
              id: m.player2.id,
              username: m.player2.username,
              isAI: m.player2.isAI,
            }
          : null,
        winner: m.winner
          ? {
              id: m.winner.id,
              username: m.winner.username,
              isAI: m.winner.isAI,
            }
          : null,
        round: m.round,
        matchIndex: m.matchIndex,
        completed: m.completed,
        gameInProgress: m.gameInProgress,
        roomId: m.roomId,
      })),
      rounds: tournament.rounds,
      currentRound: tournament.currentRound,
      size: tournament.size,
      gameMode: tournament.gameMode,
      matchType: tournament.matchType,
      completed: tournament.completed,
      winner: tournament.winner
        ? {
            id: tournament.winner.id,
            username: tournament.winner.username,
            isAI: tournament.winner.isAI,
          }
        : null,
      status: tournament.status,
      spectatorCount: tournament.spectators.length,
    };
  }

  private broadcastToTournament(
    tournamentId: string,
    event: string,
    data: any
  ) {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return;

    // Broadcast to all tournament participants
    tournament.players.forEach((player) => {
      if (player.socketId) {
        this.io.to(player.socketId).emit(event, data);
      }
    });

    // Broadcast to spectators
    tournament.spectators.forEach((spectator) => {
      this.io.to(spectator.socketId).emit(event, data);
    });
  }

  private broadcastTournamentState(tournamentId: string) {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return;

    this.broadcastToTournament(tournamentId, "tournamentUpdated", {
      tournament: this.getTournamentSafeData(tournament),
    });
  }

  private generateTournamentBracket(tournament: Tournament) {
    const matches: TournamentMatch[] = [];
    let matchId = 0;

    // Shuffle players for random seeding
    const shuffledPlayers = [...tournament.players].sort(
      () => Math.random() - 0.5
    );

    // Generate all rounds
    for (let round = 1; round <= tournament.rounds; round++) {
      const matchesInRound = Math.pow(2, tournament.rounds - round);

      for (let i = 0; i < matchesInRound; i++) {
        // Generate unique room ID for each match
        const roomId = `tournament_${
          tournament.id
        }_match_${matchId}_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        const match: TournamentMatch = {
          id: `match_${matchId++}`,
          player1: null,
          player2: null,
          winner: null,
          round,
          matchIndex: i,
          completed: false,
          position: i % 2 === 0 ? "top" : "bottom",
          roomId: roomId, // ✅ Assign room ID when creating match
        };

        // First round - assign players
        if (round === 1) {
          match.player1 = shuffledPlayers[i * 2] || null;
          match.player2 = shuffledPlayers[i * 2 + 1] || null;

          // ✅ Create room immediately for first round matches
          this.createTournamentMatchRoom(roomId, tournament, match);
        }

        matches.push(match);
      }
    }

    // Link matches to next round
    this.linkTournamentMatches(matches, tournament.rounds);
    tournament.matches = matches;

    console.log(
      `🏆 Generated ${matches.length} matches for tournament ${tournament.id}`
    );
    console.log(
      `✅ All matches have room IDs assigned and first round rooms created`
    );
  }

  private linkTournamentMatches(matches: TournamentMatch[], rounds: number) {
    matches.forEach((match) => {
      if (match.round < rounds) {
        const nextRoundMatches = matches.filter(
          (m) => m.round === match.round + 1
        );
        const nextMatchIndex = Math.floor(match.matchIndex / 2);
        const nextMatch = nextRoundMatches[nextMatchIndex];

        if (nextMatch) {
          match.nextMatchId = nextMatch.id;
        }
      }
    });
  }

  private advanceTournamentWinner(
    tournament: Tournament,
    completedMatch: TournamentMatch
  ) {
    if (!completedMatch.nextMatchId || !completedMatch.winner) return;

    const nextMatch = tournament.matches.find(
      (m) => m.id === completedMatch.nextMatchId
    );
    if (!nextMatch) return;

    // Assign winner to next match
    if (!nextMatch.player1) {
      nextMatch.player1 = completedMatch.winner;
    } else if (!nextMatch.player2) {
      nextMatch.player2 = completedMatch.winner;
    }

    // ✅ Create room when both players are assigned to next match
    if (nextMatch.player1 && nextMatch.player2 && nextMatch.roomId) {
      // Check if room already exists
      const roomExists = this.rooms.has(nextMatch.roomId);
      if (!roomExists) {
        console.log(`🏆 Creating room for next round match: ${nextMatch.id}`);
        this.createTournamentMatchRoom(nextMatch.roomId, tournament, nextMatch);
      }
    }
  }

  private checkTournamentComplete(tournament: Tournament): boolean {
    const finalRoundMatches = tournament.matches.filter(
      (m) => m.round === tournament.rounds
    );
    return (
      finalRoundMatches.length > 0 &&
      finalRoundMatches.every((m) => m.completed)
    );
  }

  private getFinalWinner(tournament: Tournament): TournamentPlayer | null {
    const finalMatch = tournament.matches.find(
      (m) => m.round === tournament.rounds && m.completed
    );
    return finalMatch?.winner || null;
  }

  private updateTournamentRound(tournament: Tournament) {
    for (let round = 1; round <= tournament.rounds; round++) {
      const matchesInRound = tournament.matches.filter(
        (m) => m.round === round
      );
      if (matchesInRound.some((m) => !m.completed)) {
        tournament.currentRound = round;
        return;
      }
    }

    tournament.currentRound = tournament.rounds;
  }

  private createTournamentMatchRoom(
    roomId: string,
    tournament: Tournament,
    match: TournamentMatch
  ) {
    // Build allowed players list from match participants
    const allowedPlayers: number[] = [];
    if (match.player1?.userId) allowedPlayers.push(match.player1.userId);
    if (match.player2?.userId) allowedPlayers.push(match.player2.userId);

    const gameRoom: GameRoom = {
      id: roomId,
      players: [],
      spectators: [],
      ball: {
        x: GAME_CONSTANTS.CANVAS.WIDTH / 2,
        y: GAME_CONSTANTS.CANVAS.HEIGHT / 2,
        vx: GAME_CONSTANTS.BALL.INITIAL_SPEED,
        vy: GAME_CONSTANTS.BALL.INITIAL_SPEED * 0.75,
        speed: GAME_CONSTANTS.BALL.INITIAL_SPEED,
      },
      gameState: "waiting",
      createdAt: new Date(),
      lastUpdate: new Date(),
      gameSettings: {
        maxScore: tournament.matchType || GAME_CONSTANTS.RULES.WINNING_SCORE,
        ballSpeed: GAME_CONSTANTS.BALL.INITIAL_SPEED,
        paddleSpeed: GAME_CONSTANTS.PADDLE.SPEED,
        width: GAME_CONSTANTS.CANVAS.WIDTH,
        height: GAME_CONSTANTS.CANVAS.HEIGHT,
        paddleWidth: GAME_CONSTANTS.PADDLE.WIDTH,
        paddleHeight: GAME_CONSTANTS.PADDLE.HEIGHT,
        ballSize: GAME_CONSTANTS.BALL.RADIUS * 2,
      },
      tournamentId: tournament.id,
      matchId: match.id,
      tournamentMatch: true,
      allowedPlayers: allowedPlayers, // ✅ Set allowed players from match
    };

    this.rooms.set(roomId, gameRoom);
    console.log(
      `🏆 Created tournament match room: ${roomId} for players: ${allowedPlayers.join(
        ", "
      )}`
    );
  }

  private deleteTournament(tournamentId: string) {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return;

    // Remove all player mappings
    tournament.players.forEach((player) => {
      this.playerToTournament.delete(player.userId);
    });

    // Notify all participants that tournament was deleted
    this.broadcastToTournament(tournamentId, "tournamentDeleted", {
      reason: "Tournament creator left",
    });

    this.tournaments.delete(tournamentId);
    this.joinCodeToTournament.delete(tournament.joinCode);
    console.log(`🏆 Tournament ${tournamentId} deleted`);
  }
}
