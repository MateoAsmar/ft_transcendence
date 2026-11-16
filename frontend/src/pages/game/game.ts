import { GAME_CONSTANTS } from "./game-constants";
import { navigateSpa } from "../../shared/navigation";
import { GameRenderer } from "../../shared/game-renderer";
import { GameClient } from "../../shared/game-client";
import { InputHandler } from "../../shared/input-handler";

/**
 * Local 2-Player Pong Game (Refactored)
 * Uses new architecture: Backend engine + Frontend presentation
 * Both players play on the same device, sending input to backend
 */
class PongGame {
  private renderer: GameRenderer;
  private client: GameClient;
  private inputHandler: InputHandler;

  private gameRunning: boolean = false;
  private countdownActive: boolean = false;
  private isExiting: boolean = false;
  private lastExitTime: number = 0;
  private readonly EXIT_DEBOUNCE_TIME = 1000;
  private updateCounter: number = 0;

  // Tournament support
  private tournamentMode: boolean = false;
  private tournamentMatch: any = null;

  // Store event listener references for cleanup
  private startBtnHandler: (() => void) | null = null;
  private exitBtnHandler: (() => void) | null = null;

  constructor() {
    // Check for tournament mode
    this.checkTournamentMode();

    // Initialize renderer
    this.renderer = new GameRenderer("gameCanvas");

    // Initialize game client with event handlers
    this.client = new GameClient({
      onConnect: () => {
        console.log("✅ Connected to game server");
        this.updateGameStatus("Connected to server");
        this.updateConnectionStatus("connected");
      },

      onDisconnect: () => {
        console.log("🔌 Disconnected from server");
        this.updateGameStatus("Disconnected from server");
        this.updateConnectionStatus("disconnected");
        this.renderer.stopRendering();
        this.gameRunning = false;
        this.countdownActive = false;
      },

      onGameFound: (data) => {
        console.log("🎮 Game found/created:", data);
        this.updateGameStatus("Game found! Marking ready...");
        // Automatically mark as ready for local 2-player
        this.client.sendReady();
      },

      onPlayerJoined: (data) => {
        console.log("👤 Player joined room:", data);
        this.updateGameStatus(`${data.players.length} player(s) in room`);

        // If room is full (2 players), automatically mark as ready
        if (data.isRoomFull && data.players.length === 2) {
          console.log("✅ Room full! Sending player ready...");
          this.client.sendReady();
          this.updateGameStatus("Waiting for game to start...");
        }
      },

      onGameStart: (data) => {
        console.log("🚀 Game starting!", data);
        console.log("📊 Renderer state before start:", {
          renderLoop: this.renderer["renderLoop"],
          currentState: this.renderer["currentState"],
        });

        this.gameRunning = true;
        this.countdownActive = false;

        // Clear any previous game over screen
        console.log("🧹 Clearing canvas...");
        this.renderer.clear();

        // Update player names if provided
        if (data.players && data.players.length === 2) {
          this.renderer.updatePlayerNames(
            data.players[0].username || "Player 1",
            data.players[1].username || "Player 2"
          );
        }

        this.updateGameStatus("Game in progress - First to 3 wins!");
        this.updateButtonStates();

        console.log("🎬 Starting renderer...");
        this.renderer.startRendering();
        console.log(
          "✅ Renderer started, renderLoop:",
          this.renderer["renderLoop"]
        );

        // Start continuous input polling for smooth paddle movement
        this.inputHandler.startPolling(50); // Poll every 50ms for smooth movement
      },

      onGameUpdate: (state) => {
        // Debug: Log first few updates to verify data flow
        if (!this.updateCounter) this.updateCounter = 0;
        this.updateCounter++;
        if (this.updateCounter <= 3 || this.updateCounter % 60 === 0) {
          console.log(`🔄 Game update #${this.updateCounter}:`, {
            ballX: state.ball.x,
            ballY: state.ball.y,
            renderLoop: this.renderer["renderLoop"],
          });
        }

        // Update renderer with state from backend
        this.renderer.updateState({
          ball: {
            x: state.ball.x,
            y: state.ball.y,
            radius: GAME_CONSTANTS.BALL.RADIUS,
          },
          paddle1: {
            x: 20,
            y: state.players[0].paddle.y,
            width: GAME_CONSTANTS.PADDLE.WIDTH,
            height: GAME_CONSTANTS.PADDLE.HEIGHT,
          },
          paddle2: {
            x: 1200 - 26, // Canvas width - paddle offset
            y: state.players[1].paddle.y,
            width: GAME_CONSTANTS.PADDLE.WIDTH,
            height: GAME_CONSTANTS.PADDLE.HEIGHT,
          },
          score1: state.players[0].score,
          score2: state.players[1].score,
        });

        // DO NOT update score display here - only update on 'score' event
        // This prevents flickering from race conditions between gameUpdate and score events
      },

      onScore: (data) => {
        console.log("⚽ Score!", data);
        this.renderer.updateScoreDisplay(data.leftScore, data.rightScore);
      },

      onGameEnd: (data) => {
        console.log("🏁 Game ended!", data);
        this.gameRunning = false;
        this.countdownActive = false;

        // Stop input polling
        this.inputHandler.stopPolling();

        // IMPORTANT: Stop the renderer to prevent multiple animation loops
        this.renderer.stopRendering();

        // Extract scores from finalScore object (backend sends as {username1: score1, username2: score2})
        // Object.values() maintains insertion order, so [0] is left player, [1] is right player
        let leftScore = 0;
        let rightScore = 0;

        if (data.finalScore && typeof data.finalScore === "object") {
          const scores = Object.values(data.finalScore) as number[];
          leftScore = scores[0] ?? 0;
          rightScore = scores[1] ?? 0;
        } else if (
          data.leftScore !== undefined &&
          data.rightScore !== undefined
        ) {
          // Fallback to old format if available
          leftScore = data.leftScore;
          rightScore = data.rightScore;
        }

        this.renderer.drawGameOver(data.winner, leftScore, rightScore);
        this.updateGameStatus(`🎉 ${data.winner} Wins! 🎉`);
        this.updateButtonStates();

        console.log("🏁 Game Over!", {
          leftScore: leftScore,
          rightScore: rightScore,
          winner: data.winner,
          tournamentMode: this.tournamentMode,
          finalScoreObject: data.finalScore,
        });

        // Clean up game room after game ends
        setTimeout(() => {
          console.log("🧹 Cleaning up game room...");
          this.client.leaveRoom();
        }, 1000);

        // Handle tournament mode
        if (this.tournamentMode && this.tournamentMatch) {
          console.log("🏆 Tournament game - not saving to database");
          this.handleTournamentEnd(data.winner);
          return;
        }

        // Save game result for normal mode
        console.log("💿 Normal game - saving to database");
        // this.saveGameResult(leftScore, rightScore);
      },

      onCountdown: (count) => {
        console.log("⏱️ Countdown received:", count);
        this.countdownActive = true;
        this.renderer.updateCountdown(count);
        console.log(
          "⏱️ Renderer countdown state updated:",
          this.renderer["countdownState"]
        );

        if (count === 0) {
          this.renderer.clearCountdown();
          this.countdownActive = false;
          console.log("⏱️ Countdown cleared");
        }
      },

      onError: (error) => {
        console.error("❌ Game error:", error);
        this.updateGameStatus(`Error: ${error}`);
        this.gameRunning = false;
        this.countdownActive = false;
        this.updateButtonStates();
      },
    });

    // Initialize input handler - both players on same device
    this.inputHandler = new InputHandler({
      onPlayer1Input: (direction) => {
        // Send player 1 input to backend (left paddle, index 0)
        this.client.sendPaddleMove(direction, 0);
      },
      onPlayer2Input: (direction) => {
        // Send player 2 input to backend (right paddle, index 1)
        this.client.sendPaddleMove(direction, 1);
      },
    });

    // Setup touch controls and mobile buttons
    this.inputHandler.setupTouchControls("gameCanvas");
    this.inputHandler.setupMobileButtons();

    // Note: Input polling will start when the game starts (see onGameStart handler)

    // Setup event listeners
    this.setupEventListeners();

    // Load user info
    this.loadUserInfo();
  }

  private checkTournamentMode(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const isTournament = urlParams.get("tournament") === "true";

    if (isTournament) {
      const tournamentMatchData = localStorage.getItem("tournamentMatch");
      if (tournamentMatchData) {
        this.tournamentMatch = JSON.parse(tournamentMatchData);
        this.tournamentMode = true;
        // Note: Winning score is now handled by backend engine
      }
    }
  }

  private setupEventListeners(): void {
    const startBtn = document.getElementById("startBtn");
    if (startBtn) {
      this.startBtnHandler = () => {
        this.startGame();
      };
      startBtn.addEventListener("click", this.startBtnHandler);
    }

    const exitBtn = document.getElementById("exitBtn");
    if (exitBtn) {
      this.exitBtnHandler = () => {
        this.exitMatch();
      };
      exitBtn.addEventListener("click", this.exitBtnHandler);
    }
  }

  private loadUserInfo(): void {
    try {
      // Tournament mode - use tournament player names
      if (this.tournamentMode && this.tournamentMatch) {
        const player1NameElement = document.getElementById("player1Name");
        const player2NameElement = document.getElementById("player2Name");

        if (player1NameElement) {
          player1NameElement.textContent = this.tournamentMatch.player1.name;
        }
        if (player2NameElement) {
          player2NameElement.textContent = this.tournamentMatch.player2.name;
        }
        return;
      }

      // Regular mode - use stored user info
      const userString = localStorage.getItem("user");
      if (!userString) return;

      const user = JSON.parse(userString);
      const player1NameElement = document.getElementById("player1Name");
      const player2NameElement = document.getElementById("player2Name");

      if (player1NameElement) {
        const displayName = user.display_name || user.username || "Player 1";
        player1NameElement.textContent = displayName;
      }

      if (player2NameElement && !this.tournamentMode) {
        player2NameElement.textContent = "Player 2";
      }
    } catch (error) {
      console.error("Error loading user info:", error);
    }
  }

  public async startGame(): Promise<void> {
    console.log("🎮 START GAME clicked", {
      gameRunning: this.gameRunning,
      countdownActive: this.countdownActive,
      isExiting: this.isExiting,
    });

    // Prevent spam clicking
    if (this.gameRunning || this.countdownActive || this.isExiting) {
      console.log("⚠️ Cannot start game - already running or exiting");
      return;
    }

    // Make sure we're fully disconnected from previous game
    console.log("🧹 Ensuring clean state before new game...");
    this.renderer.stopRendering();
    this.client.leaveRoom();

    this.updateGameStatus("Connecting to game server...");
    this.updateConnectionStatus("connecting");
    this.updateButtonStates();

    try {
      // Connect to backend
      console.log("🔌 Connecting to backend...");
      await this.client.connect();
      console.log("✅ Connected to backend");

      // For local 2-player: create a private room with 'local' mode
      // Both players share the same keyboard on the same device
      console.log("🏠 Creating private room...");
      this.client.createPrivateRoom("local");

      this.updateGameStatus("Starting local 2-player game...");
    } catch (error) {
      console.error("❌ Failed to start game:", error);
      this.updateGameStatus("Failed to start game. Please try again.");
      this.updateButtonStates();
    }
  }

  public exitMatch(): void {
    const currentTime = Date.now();

    // Prevent spam clicking
    if (
      this.isExiting ||
      currentTime - this.lastExitTime < this.EXIT_DEBOUNCE_TIME
    ) {
      return;
    }

    // Check if there's a game to exit
    if (!this.gameRunning && !this.countdownActive) {
      return;
    }

    this.isExiting = true;
    this.lastExitTime = currentTime;

    this.updateGameStatus("Returning to menu...");
    this.updateButtonStates();

    // Stop everything
    this.gameRunning = false;
    this.countdownActive = false;

    // Stop input polling
    this.inputHandler.stopPolling();

    this.renderer.stopRendering();
    this.client.leaveRoom();

    // Cleanup and redirect
    setTimeout(() => {
      this.cleanup();
      navigateSpa("/dashboard");
    }, 500);
  }

  private handleTournamentEnd(winner: string): void {
    // Determine winner ID for tournament
    let winnerId = "";
    if (winner.includes(this.tournamentMatch.player1.name)) {
      winnerId = this.tournamentMatch.player1.id;
    } else if (winner.includes(this.tournamentMatch.player2.name)) {
      winnerId = this.tournamentMatch.player2.id;
    }

    // Delay before returning to tournament
    setTimeout(() => {
      localStorage.removeItem("tournamentMatch");
      this.cleanup();
      navigateSpa(
        `/tournament?return=true&winner=${encodeURIComponent(winnerId)}`
      );
    }, 3000);
  }

  private updateGameStatus(status: string): void {
    const statusElement = document.getElementById("gameStatus");
    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  private updateConnectionStatus(
    status: "connected" | "connecting" | "disconnected"
  ): void {
    console.log("🔄 Updating connection status to:", status);

    const statusText = document.getElementById("connectionStatus");
    const statusIndicator = document.getElementById("connectionIndicator");
    const statusContainer = document.getElementById(
      "connectionStatusContainer"
    );

    if (statusText) {
      const textClass =
        status === "connected"
          ? "text-green-300"
          : status === "connecting"
          ? "text-orange-300"
          : "text-red-300";
      statusText.textContent =
        status === "connected"
          ? "Connected"
          : status === "connecting"
          ? "Connecting..."
          : "Disconnected";
      statusText.className = `text-sm font-medium ${textClass}`;
      console.log("✅ Status text updated to:", statusText.textContent);
    } else {
      console.warn("⚠️ connectionStatus element not found");
    }

    if (statusIndicator) {
      const baseIndicator = "h-2 w-2 rounded-full";
      const indicatorClass =
        status === "connected"
          ? `${baseIndicator} bg-green-400`
          : status === "connecting"
          ? `${baseIndicator} bg-orange-400 animate-pulse`
          : `${baseIndicator} bg-red-400`;
      statusIndicator.className = indicatorClass;
      console.log(
        "✅ Status indicator updated with class:",
        statusIndicator.className
      );
    } else {
      console.warn("⚠️ connectionIndicator element not found");
    }

    if (statusContainer) {
      statusContainer.classList.remove(
        "border-gray-700",
        "border-purple-500/60",
        "border-green-500/60",
        "border-orange-400/60",
        "border-red-500/60"
      );
      const borderClass =
        status === "connected"
          ? "border-green-500/60"
          : status === "connecting"
          ? "border-orange-400/60"
          : "border-red-500/60";
      statusContainer.classList.add(borderClass);
    }
  }

  private updateButtonStates(): void {
    const startBtn = document.getElementById("startBtn") as HTMLButtonElement;
    const exitBtn = document.getElementById("exitBtn") as HTMLButtonElement;

    if (startBtn) {
      startBtn.disabled =
        this.gameRunning || this.countdownActive || this.isExiting;

      if (this.gameRunning || this.countdownActive) {
        startBtn.style.display = "none";
        document.body.classList.add("game-running");
      } else {
        startBtn.style.display = "block";
        document.body.classList.remove("game-running");
      }
    }

    if (exitBtn) {
      exitBtn.disabled = this.isExiting;

      if (this.gameRunning || this.countdownActive) {
        exitBtn.style.display = "block";
      } else {
        exitBtn.style.display = "none";
      }
    }
  }

  private cleanup(): void {
    // Stop all game loops and timers
    this.inputHandler.stopPolling();
    this.renderer.stopRendering();

    // Disconnect and cleanup
    this.client.disconnect();
    this.renderer.destroy();
    this.inputHandler.destroy();

    // Remove event listeners
    const startBtn = document.getElementById("startBtn");
    if (startBtn && this.startBtnHandler) {
      startBtn.removeEventListener("click", this.startBtnHandler);
    }

    const exitBtn = document.getElementById("exitBtn");
    if (exitBtn && this.exitBtnHandler) {
      exitBtn.removeEventListener("click", this.exitBtnHandler);
    }
  }
}

// Store the current game instance to allow cleanup
let currentGameInstance: PongGame | null = null;

async function bootstrapPongGame() {
  // Display user info from cached data (already validated by router)
  try {
    const userString = localStorage.getItem("user");
    if (userString && userString !== "undefined") {
      const user = JSON.parse(userString);
      const userInfoElement = document.getElementById("userInfo");
      if (userInfoElement) {
        const username = user.username || user.display_name || "Player";
        userInfoElement.textContent = `Player: ${username}`;
      }
    }
  } catch (error) {
    console.error("Error displaying user info:", error);
  }

  // Initialize game - check if canvas exists first
  const canvas = document.getElementById("gameCanvas");
  if (!canvas) {
    console.error("❌ Canvas not found! Waiting for DOM...");
    // Retry after a short delay
    setTimeout(() => {
      const retryCanvas = document.getElementById("gameCanvas");
      if (retryCanvas) {
        console.log("✅ Canvas found on retry, initializing game...");
        new PongGame();
      } else {
        console.error("❌ Canvas still not found after retry!");
      }
    }, 100);
    return;
  }

  console.log("✅ Canvas found, initializing local 2-player game...");

  // Cleanup previous game instance if it exists
  if (currentGameInstance) {
    console.log("🧹 Cleaning up previous game instance...");
    try {
      (currentGameInstance as any).cleanup();
    } catch (e) {
      console.warn("Error cleaning up previous instance:", e);
    }
    currentGameInstance = null;
  }

  currentGameInstance = new PongGame();
}

// Don't auto-bootstrap - let page.ts handle it for SPA mode
// This export is called by page.ts
export { bootstrapPongGame };
