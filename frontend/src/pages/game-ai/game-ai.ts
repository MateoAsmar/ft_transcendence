import { GAME_CONSTANTS } from "../game/game-constants";
import { navigateSpa } from "../../shared/navigation";
import { GameRenderer } from "../../shared/game-renderer";
import { GameClient } from "../../shared/game-client";
import { InputHandler } from "../../shared/input-handler";

/**
 * AI-Enabled Pong Game (Refactored)
 * Uses new architecture: Backend engine + Frontend presentation
 * AI logic should run on backend (future enhancement)
 * For now: Player vs AI, with AI input sent to backend
 */
class AIEnabledPongGame {
  private renderer: GameRenderer;
  private client: GameClient;
  private inputHandler: InputHandler;

  private gameRunning: boolean = false;
  private countdownActive: boolean = false;
  private isExiting: boolean = false;
  private lastExitTime: number = 0;
  private readonly EXIT_DEBOUNCE_TIME = 1000;

  // Store disconnect timeout to clear it if needed
  private disconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  // AI settings
  private currentDifficulty: string = "medium";

  // Tournament support
  private tournamentMode: boolean = false;
  private tournamentMatch: any = null;

  // Store event listener references for cleanup
  private startBtnHandler: (() => void) | null = null;
  private exitBtnHandler: (() => void) | null = null;
  private difficultyHandlers: Map<Element, EventListener> = new Map();

  constructor() {
    // Check for tournament mode
    this.checkTournamentMode();

    // Initialize renderer
    this.renderer = new GameRenderer("gameCanvas");

    // Initialize game client
    this.client = new GameClient({
      onConnect: () => {
        console.log("✅ Connected to game server");
        this.updateGameStatus("Connected to server");
        this.updateConnectionStatus("connected");
      },

      onGameFound: (data) => {
        console.log("🎮 Game room found:", data);
        this.updateGameStatus("Joining AI game...");
        // Immediately send ready for AI games
        this.client.sendReady();
      },

      onDisconnect: () => {
        console.log("🔌 Disconnected from server");
        this.updateGameStatus("Disconnected from server");
        this.updateConnectionStatus("disconnected");
        this.renderer.stopRendering();
        this.gameRunning = false;
        this.countdownActive = false;
      },

      onPlayerJoined: (data) => {
        console.log("👤 Player joined room:", data);
        this.updateGameStatus(`${data.players.length}/2 players ready`);

        // If room is full (2 players), automatically mark as ready
        if (data.isRoomFull && data.players.length === 2) {
          console.log("✅ Room full! Sending player ready...");
          this.client.sendReady();
          this.updateGameStatus("Waiting for game to start...");
        }
      },

      onGameStart: (data) => {
        console.log("🚀 Game starting!", data);
        this.gameRunning = true;
        this.countdownActive = false;

        // Clear any previous game over screen
        this.renderer.clear();

        // Update player names
        if (data.players && data.players.length === 2) {
          this.renderer.updatePlayerNames(
            data.players[0].username || "You",
            data.players[1].username || "AI Opponent"
          );
        }

        this.updateGameStatus(`Playing vs AI (${this.currentDifficulty})`);
        this.updateButtonStates();

        // Ensure rendering is started (will stop any existing loop first)
        this.renderer.startRendering();

        // Start continuous input polling for smooth paddle movement
        this.inputHandler.startPolling(50); // Poll every 50ms for smooth movement
      },

      onGameUpdate: (state) => {
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
            x: 1200 - 26,
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
        console.log("⚽ Score event received!", {
          leftScore: data.leftScore,
          rightScore: data.rightScore,
          scorer: data.scorer,
          timestamp: Date.now(),
        });
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
          this.handleTournamentEnd(data.winner);
          return;
        }

        // Save game result
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

    // Initialize input handler - only player 1 (human player)
    // DON'T register onPlayer2Input so arrow keys work for Player 1
    this.inputHandler = new InputHandler({
      onPlayer1Input: (direction) => {
        // Send player input to backend (left paddle, index 0)
        this.client.sendPaddleMove(direction, 0);
      },
      // onPlayer2Input NOT registered - AI controls player 2 on backend
    });

    // Setup controls
    this.inputHandler.setupTouchControls("gameCanvas");
    this.inputHandler.setupMobileButtons();

    // Note: Input polling will start when the game starts (see onGameStart handler)

    // Setup event listeners
    this.setupEventListeners();

    // Load user info
    this.loadUserInfo();

    // Update AI status
    this.updateAIStatus();
  }

  private checkTournamentMode(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const isTournament = urlParams.get("tournament") === "true";

    if (isTournament) {
      const tournamentMatchData = localStorage.getItem("tournamentMatch");
      if (tournamentMatchData) {
        this.tournamentMatch = JSON.parse(tournamentMatchData);
        this.tournamentMode = true;
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

    // AI difficulty buttons
    const difficultyButtons = document.querySelectorAll("[data-difficulty]");
    difficultyButtons.forEach((button) => {
      const handler = (e: Event) => {
        const target = e.target as HTMLElement;
        const difficulty = target.getAttribute("data-difficulty");
        if (difficulty) {
          this.setDifficulty(difficulty);
        }
      };
      this.difficultyHandlers.set(button, handler);
      button.addEventListener("click", handler);
    });
  }

  public async startGame(): Promise<void> {
    // Prevent spam clicking
    if (this.gameRunning || this.countdownActive || this.isExiting) {
      return;
    }

    // Clear any pending disconnect timeout from previous game
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }

    // Clean up any previous game state
    this.renderer.stopRendering();
    this.inputHandler.stopPolling();

    // Disconnect if already connected to ensure clean state
    if (this.client.isConnected()) {
      this.client.disconnect();
      // Wait a bit for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.updateGameStatus("Connecting to game server...");
    this.updateConnectionStatus("connecting");
    this.updateButtonStates();

    try {
      // Connect to backend
      await this.client.connect();

      // Create AI game room with 'ai' mode and current difficulty
      // Backend will allow single-player room for AI opponents
      this.client.createPrivateRoom(
        "ai",
        this.currentDifficulty as "easy" | "medium" | "hard"
      );

      this.updateGameStatus("Starting AI game...");
    } catch (error) {
      console.error("Failed to start game:", error);
      this.updateGameStatus("Failed to start game. Please try again.");
      this.updateButtonStates();
    }
  }

  public exitMatch(): void {
    const currentTime = Date.now();

    if (
      this.isExiting ||
      currentTime - this.lastExitTime < this.EXIT_DEBOUNCE_TIME
    ) {
      return;
    }

    if (!this.gameRunning && !this.countdownActive) {
      return;
    }

    this.isExiting = true;
    this.lastExitTime = currentTime;

    this.updateGameStatus("Returning to menu...");
    this.updateButtonStates();

    this.gameRunning = false;
    this.countdownActive = false;

    // Stop input polling
    this.inputHandler.stopPolling();

    this.renderer.stopRendering();
    this.client.leaveRoom();

    setTimeout(() => {
      this.cleanup();
      navigateSpa("/dashboard");
      this.isExiting = false;
    }, 500);
  }

  private setDifficulty(difficulty: string): void {
    if (this.gameRunning || this.countdownActive) {
      return; // Can't change difficulty during game
    }

    this.currentDifficulty = difficulty;
    console.log("?? AI difficulty set to:", difficulty);

    const difficultyButtons = document.querySelectorAll("[data-difficulty]");
    difficultyButtons.forEach((button) => {
      const btnDifficulty = button.getAttribute("data-difficulty");
      if (btnDifficulty === difficulty) {
        button.classList.add("bg-cyan-600", "border-cyan-400");
        button.classList.remove("bg-gray-700", "border-gray-600");
      } else {
        button.classList.remove("bg-cyan-600", "border-cyan-400");
        button.classList.add("bg-gray-700", "border-gray-600");
      }
    });

    this.updateAIStatus();
    this.loadUserInfo();
    this.updateButtonStates();
  }

  private loadUserInfo(): void {
    try {
      const raw = localStorage.getItem("user");
      if (!raw || raw === "undefined") return;

      const profile = JSON.parse(raw);
      const displayName = profile.display_name || profile.username || "You";

      const userInfoElement = document.getElementById("userInfo");
      if (userInfoElement) {
        userInfoElement.textContent = `Player: ${displayName}`;
      }

      const player1Label = document.getElementById("player1Name");
      if (player1Label) {
        player1Label.textContent = displayName;
      }
    } catch (error) {
      console.warn("Unable to hydrate AI game user info", error);
    }
  }

  private updateAIStatus(): void {
    const aiStatusElement = document.getElementById("aiStatus");
    if (aiStatusElement) {
      const difficultyText =
        {
          easy: "?? Easy",
          medium: "?? Medium",
          hard: "?? Hard",
        }[this.currentDifficulty] || "?? Medium";

      aiStatusElement.textContent = `AI: ${difficultyText}`;
    }
  }

  private handleTournamentEnd(winner: string): void {
    let winnerId = "";
    if (winner.includes(this.tournamentMatch.player1.name)) {
      winnerId = this.tournamentMatch.player1.id;
    }

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

    // Remove difficulty button listeners
    this.difficultyHandlers.forEach((handler, button) => {
      button.removeEventListener("click", handler);
    });
    this.difficultyHandlers.clear();
  }
}

// Bootstrap function
// Store the current game instance to allow cleanup
let currentAIGameInstance: AIEnabledPongGame | null = null;

function bootstrapAIGame() {
  const start = () => {
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) {
      console.error("❌ Canvas not found for AI game render");
      return;
    }

    // Cleanup previous game instance if it exists
    if (currentAIGameInstance) {
      console.log("🧹 Cleaning up previous AI game instance...");
      try {
        (currentAIGameInstance as any).cleanup();
      } catch (e) {
        console.warn("Error cleaning up previous AI instance:", e);
      }
      currentAIGameInstance = null;
    }

    console.log("✅ Canvas found, initializing AI game...");
    currentAIGameInstance = new AIEnabledPongGame();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

// Don't auto-bootstrap - let page.ts handle it for SPA mode
// This export is called by page.ts
export { bootstrapAIGame };
