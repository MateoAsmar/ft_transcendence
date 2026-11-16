// Tournament Play Manager - Handles tournament match gameplay with proper routing
import { io, Socket } from "socket.io-client";
import { showPopupNotification } from "../../notification";
import { navigateSpa } from "../../shared/navigation";
import { GAME_CONSTANTS } from "../game/game-constants";

interface Player {
  id: string;
  username: string;
  score: number;
  paddle?: { y: number; speed: number };
}

interface GameState {
  ball: { x: number; y: number; vx: number; vy: number };
  players: Player[];
}

export class TournamentPlayManager {
  private socket: Socket | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private gameState: GameState | null = null;
  private currentPlayer: Player | null = null;
  private tournamentId: string | null = null;
  private matchId: string | null = null;
  private roomId: string | null = null;
  private gameLoopId: number = 0;
  private keys: { [key: string]: boolean } = {};
  private countdownActive: boolean = false;
  private countdownValue: number = 0;
  private isSpectator: boolean = false;

  constructor() {
    console.log("🎮 Tournament Play Manager initialized");

    this.canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
    this.ctx = this.canvas?.getContext("2d");

    if (!this.canvas || !this.ctx) {
      showPopupNotification("Failed to initialize canvas", "error");
      return;
    }

    // Check if in spectate mode
    const params = new URLSearchParams(window.location.search);
    this.isSpectator = params.get("spectate") === "true";

    if (!this.isSpectator) {
      this.validateMatchAuthorization();
    }

    this.getMatchParamsFromUrl();
    this.setupCanvasEventPrevention();

    // Only setup keyboard controls for players
    if (!this.isSpectator) {
      this.setupKeyboardControls();
    }

    this.initializeSocket();
  }

  private validateMatchAuthorization(): void {
    try {
      const authString = localStorage.getItem("currentMatchAuth");
      if (!authString) {
        showPopupNotification("No match authorization found", "error");
        setTimeout(() => navigateSpa("/tournament"), 2000);
        return;
      }

      const auth = JSON.parse(authString);
      const params = new URLSearchParams(window.location.search);

      // Validate parameters match
      if (
        auth.tournamentId !== params.get("tournamentId") ||
        auth.matchId !== params.get("matchId") ||
        auth.roomId !== params.get("roomId")
      ) {
        showPopupNotification("Match authorization mismatch", "error");
        setTimeout(() => navigateSpa("/tournament"), 2000);
        return;
      }

      // Check authorization timestamp (10 minute expiry)
      const now = Date.now();
      const authAge = now - auth.timestamp;
      if (authAge > 10 * 60 * 1000) {
        showPopupNotification("Match authorization expired", "error");
        localStorage.removeItem("currentMatchAuth");
        setTimeout(() => navigateSpa("/tournament"), 2000);
        return;
      }
    } catch (error) {
      console.error("Authorization validation failed:", error);
      setTimeout(() => navigateSpa("/tournament"), 2000);
    }
  }

  private setupCanvasEventPrevention(): void {
    if (!this.canvas) return;

    // Prevent context menu on right click
    this.canvas.addEventListener("contextmenu", (e: MouseEvent) => {
      e.preventDefault();
    });

    // Prevent touch actions (scrolling, zooming, etc.)
    this.canvas.addEventListener(
      "touchstart",
      (e: TouchEvent) => {
        e.preventDefault();
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      "touchmove",
      (e: TouchEvent) => {
        e.preventDefault();
      },
      { passive: false }
    );

    this.canvas.addEventListener(
      "touchend",
      (e: TouchEvent) => {
        e.preventDefault();
      },
      { passive: false }
    );

    // Prevent drag operations
    this.canvas.addEventListener("dragstart", (e: DragEvent) => {
      e.preventDefault();
    });

    // Make canvas focusable and prevent focus-related scrolling
    this.canvas.setAttribute("tabindex", "0");

    console.log("✅ Canvas event prevention configured");
  }

  private getMatchParamsFromUrl(): void {
    const params = new URLSearchParams(window.location.search);
    this.tournamentId = params.get("tournamentId");
    this.matchId = params.get("matchId");
    this.roomId = params.get("roomId");

    if (!this.tournamentId || !this.matchId || !this.roomId) {
      showPopupNotification("Invalid match parameters", "error");
      setTimeout(() => navigateSpa("/tournament"), 2000);
    }
  }

  private initializeSocket(): void {
    const socketUrl =
      window.location.protocol === "https:"
        ? `wss://${window.location.host}`
        : `ws://${window.location.host}`;

    this.socket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      secure: window.location.protocol === "https:",
      withCredentials: true,
    });

    this.socket.on("connect", () => {
      console.log("✅ Socket connected");
      this.updateConnectionStatus("connected", "Connected");
      this.joinMatch();
    });

    this.socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      this.updateConnectionStatus("disconnected", "Disconnected");
      this.stopGameLoop();
    });

    this.setupSocketEventHandlers();
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    // Spectator joined event
    if (this.isSpectator) {
      this.socket.on(
        "spectatorJoined",
        (data: {
          roomId: string;
          gameState: string;
          players: Player[];
          ball: any;
        }) => {
          console.log("✅ Successfully joined as spectator:", data);
          this.gameState = {
            ball: data.ball,
            players: data.players,
          };
          this.hideWaitingOverlay();
          this.startGameLoop();
        }
      );
    }

    // Player joined - updated to match backend data structure
    this.socket.on(
      "playerJoined",
      (data: {
        players: Player[];
        gameState: string;
        isRoomFull: boolean;
        gameSettings: any;
      }) => {
        console.log(
          "✅ Players in room:",
          data.players.map((p) => p.username).join(", ")
        );

        // Find current player from the list (only for non-spectators)
        if (!this.isSpectator) {
          const userStr = localStorage.getItem("user");
          if (userStr) {
            const user = JSON.parse(userStr);
            this.currentPlayer =
              data.players.find((p) => p.id === user.id.toString()) || null;
          }
        }

        console.log(
          `📊 Room status: ${data.players.length}/2 players, ${
            data.isRoomFull ? "FULL" : "Waiting for opponent"
          }`
        );
      }
    );

    // Game started
    this.socket.on("gameStart", (data: any) => {
      console.log("🎮 Game started!", data);

      // Update player names in scoreboard
      if (data.players && data.players.length === 2) {
        const player1NameElement = document.getElementById("player1Name");
        const player2NameElement = document.getElementById("player2Name");

        if (player1NameElement) {
          player1NameElement.textContent =
            data.players[0].username || "Player 1";
        }
        if (player2NameElement) {
          player2NameElement.textContent =
            data.players[1].username || "Player 2";
        }

        console.log(
          "✅ Player names updated:",
          data.players[0].username,
          "vs",
          data.players[1].username
        );
      }

      this.hideWaitingOverlay();
      this.startGameLoop();
    });

    // Game updates
    this.socket.on("gameUpdate", (data: any) => {
      if (data.ball && data.players) {
        this.gameState = {
          ball: data.ball,
          players: data.players,
        };
      }
    });

    // Score updates
    this.socket.on(
      "score",
      (data: { leftScore: number; rightScore: number; scorer: string }) => {
        console.log("⚽ Score!", data);
        // Update scoreboard directly with the scores from the event
        const score1Element = document.getElementById("score1");
        const score2Element = document.getElementById("score2");
        if (score1Element)
          score1Element.textContent = data.leftScore.toString();
        if (score2Element)
          score2Element.textContent = data.rightScore.toString();

        // Also update gameState if available
        if (this.gameState?.players) {
          if (this.gameState.players[0])
            this.gameState.players[0].score = data.leftScore;
          if (this.gameState.players[1])
            this.gameState.players[1].score = data.rightScore;
        }
      }
    );

    // Countdown
    this.socket.on("countdown", (count: number) => {
      console.log("⏱️  Countdown received:", count);
      this.countdownActive = true;
      this.countdownValue = count;
      if (count === 0) {
        this.countdownActive = false;
      }
    });

    // Game end
    this.socket.on("gameEnd", (data: { winner: string; finalScore: any }) => {
      console.log("🏆 Game ended!", data);
      this.endGame(data.winner, data.finalScore);
    });

    // Error
    this.socket.on("error", (data: any) => {
      const errorMessage =
        typeof data === "string" ? data : data?.message || "Unknown error";
      console.error("❌ Error:", errorMessage);
      showPopupNotification(errorMessage, "error");
    });
  }

  private setupKeyboardControls(): void {
    window.addEventListener("keydown", (e) => {
      // Don't handle keyboard input if spectating
      if (this.isSpectator) return;

      this.keys[e.key] = true;

      if (
        this.socket &&
        (e.key === "w" ||
          e.key === "s" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown")
      ) {
        // Prevent default browser behavior (scrolling)
        e.preventDefault();

        // Map keys to direction for playerMove event
        let direction: "up" | "down" | "stop" = "stop";
        if (e.key === "w" || e.key === "ArrowUp") {
          direction = "up";
        } else if (e.key === "s" || e.key === "ArrowDown") {
          direction = "down";
        }

        // Backend expects 'playerMove' not 'paddleMove'
        this.socket.emit("playerMove", { direction });
      }
    });

    window.addEventListener("keyup", (e) => {
      // Don't handle keyboard input if spectating
      if (this.isSpectator) return;

      this.keys[e.key] = false;

      // Send stop when keys are released
      if (
        this.socket &&
        (e.key === "w" ||
          e.key === "s" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown")
      ) {
        e.preventDefault();
        this.socket.emit("playerMove", { direction: "stop" });
      }
    });
  }

  private joinMatch(): void {
    if (!this.socket || !this.roomId) return;

    if (this.isSpectator) {
      console.log("👁️ Joining as spectator to room:", this.roomId);
      this.socket.emit("spectateGame", { roomId: this.roomId });
    } else {
      console.log("🎮 Joining tournament match room:", this.roomId);
      this.socket.emit("joinRoom", {
        roomId: this.roomId,
        tournamentMatch: true,
        tournamentId: this.tournamentId,
        matchId: this.matchId,
      });

      // Auto-ready for tournament matches after a short delay
      setTimeout(() => {
        if (this.socket && this.roomId) {
          console.log("✅ Marking player as ready");
          this.socket.emit("playerReady", { roomId: this.roomId });
        }
      }, 500);
    }
  }

  private startGameLoop(): void {
    const render = () => {
      this.renderGame();
      this.gameLoopId = requestAnimationFrame(render);
    };
    render();
  }

  private stopGameLoop(): void {
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = 0;
    }
  }

  private renderGame(): void {
    if (!this.ctx || !this.canvas || !this.gameState) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    this.ctx.fillStyle = "#0f172a";
    this.ctx.fillRect(0, 0, width, height);

    // Draw center line
    this.ctx.strokeStyle = "#334155";
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([10, 10]);
    this.ctx.beginPath();
    this.ctx.moveTo(width / 2, 0);
    this.ctx.lineTo(width / 2, height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw paddles
    const paddleWidth = GAME_CONSTANTS.PADDLE.WIDTH;
    const paddleHeight = GAME_CONSTANTS.PADDLE.HEIGHT;

    this.gameState.players.forEach((player, index) => {
      if (!player.paddle) return;

      const x = index === 0 ? 20 : width - 20 - paddleWidth;
      const y = player.paddle.y;

      // Gradient for paddles
      const gradient = this.ctx!.createLinearGradient(
        x,
        y,
        x,
        y + paddleHeight
      );
      gradient.addColorStop(0, index === 0 ? "#06b6d4" : "#a855f7");
      gradient.addColorStop(1, index === 0 ? "#0891b2" : "#9333ea");

      this.ctx!.fillStyle = gradient;
      this.ctx!.fillRect(x, y, paddleWidth, paddleHeight);
    });

    // Draw ball
    const ball = this.gameState.ball;
    const ballRadius = GAME_CONSTANTS.BALL.RADIUS;

    const ballGradient = this.ctx.createRadialGradient(
      ball.x,
      ball.y,
      0,
      ball.x,
      ball.y,
      ballRadius
    );
    ballGradient.addColorStop(0, "#ffffff");
    ballGradient.addColorStop(1, "#f0f0f0");

    this.ctx.fillStyle = ballGradient;
    this.ctx.beginPath();
    this.ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw countdown if active
    if (this.countdownActive && this.countdownValue > 0) {
      const messages: { [key: number]: string } = {
        3: "READY",
        2: "SET",
        1: "GO!",
      };
      const colors: { [key: number]: string } = {
        3: "#22d3ee",
        2: "#fbbf24",
        1: "#10b981",
      };
      const message =
        messages[this.countdownValue] || this.countdownValue.toString();
      const color = colors[this.countdownValue] || "#22d3ee";

      this.ctx.font = "bold 80px Arial";
      this.ctx.fillStyle = color;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(message, width / 2, height / 2);
    }
  }

  private endGame(winner: string, finalScore: any): void {
    this.stopGameLoop();

    // If spectator, just show game ended message and redirect to brackets
    if (this.isSpectator) {
      const gameOverModal = document.getElementById("gameOverModal");
      const gameOverText = document.getElementById("gameOverText");
      const gameOverResult = document.getElementById("gameOverResult");
      const winnerIcon = document.getElementById("winnerIcon");
      const playAgainBtn = document.getElementById("playAgainBtn");
      const backToMenuBtn = document.getElementById("backToMenuBtn");

      if (gameOverText) {
        gameOverText.textContent = `${winner} Won!`;
      }

      if (gameOverResult) {
        gameOverResult.textContent = Object.entries(finalScore)
          .map(([name, score]) => `${name}: ${score}`)
          .join(" - ");
      }

      if (winnerIcon) {
        winnerIcon.textContent = "👁️";
        winnerIcon.className =
          "w-20 h-20 mx-auto mb-4 rounded-full border-2 border-yellow-400 flex items-center justify-center text-4xl";
      }

      // Hide the action buttons for spectators
      if (playAgainBtn) playAgainBtn.style.display = "none";
      if (backToMenuBtn) backToMenuBtn.style.display = "none";

      if (gameOverModal) {
        gameOverModal.style.display = "flex";
      }

      // Redirect spectators back to brackets
      setTimeout(() => {
        navigateSpa(`/tournament/brackets?id=${this.tournamentId}`);
      }, 5000);
      return;
    }

    // Find winner's player ID from game state
    const winnerPlayer = this.gameState?.players.find(
      (p) => p.username === winner
    );
    const winnerId = winnerPlayer?.id;

    // Store match result with winnerId for backend
    const matchResult = {
      winner: winner,
      winnerId: winnerId,
      finalScore: finalScore,
      timestamp: Date.now(),
      matchData: {
        tournamentId: this.tournamentId,
        matchId: this.matchId,
      },
    };
    localStorage.setItem("tournamentMatchResult", JSON.stringify(matchResult));

    // Update game over modal
    const gameOverText = document.getElementById("gameOverText");
    const gameOverResult = document.getElementById("gameOverResult");
    const winnerIcon = document.getElementById("winnerIcon");
    const gameOverModal = document.getElementById("gameOverModal");
    const playAgainBtn = document.getElementById("playAgainBtn");
    const backToMenuBtn = document.getElementById("backToMenuBtn");

    const isWinner = winner === this.currentPlayer?.username;

    if (gameOverText) {
      gameOverText.textContent = isWinner ? "You Won! 🎉" : "You Lost";
      gameOverText.className = isWinner
        ? "text-3xl font-bold text-center text-green-400"
        : "text-3xl font-bold text-center text-red-400";
    }

    if (gameOverResult) {
      const resultMessage = isWinner
        ? "Advancing to the next round!"
        : "Better luck next time!";
      gameOverResult.innerHTML = `
        <div class="space-y-2">
          <p class="text-lg font-semibold">${resultMessage}</p>
          <p class="text-sm text-gray-400">Final Score: ${Object.entries(
            finalScore
          )
            .map(([name, score]) => `${name}: ${score}`)
            .join(" - ")}</p>
          <p class="text-xs text-gray-500 mt-4">Redirecting in 5 seconds...</p>
        </div>
      `;
    }

    if (winnerIcon) {
      winnerIcon.textContent = isWinner ? "🏆" : "😔";
      winnerIcon.className = `w-20 h-20 mx-auto mb-4 rounded-full border-2 flex items-center justify-center text-4xl ${
        isWinner ? "border-green-400" : "border-red-400"
      }`;
    }

    // Hide the action buttons for tournament mode
    if (playAgainBtn) playAgainBtn.style.display = "none";
    if (backToMenuBtn) backToMenuBtn.style.display = "none";

    if (gameOverModal) {
      gameOverModal.style.display = "flex";
    }

    // CRITICAL: Route winners to brackets, losers to setup
    setTimeout(() => {
      if (isWinner) {
        // Winner goes to brackets to see progression
        navigateSpa(`/tournament/brackets?id=${this.tournamentId}`);
      } else {
        // Loser goes back to tournament setup
        this.exitToSetup();
      }
    }, 5000);
  }

  private hideWaitingOverlay(): void {
    const overlay = document.getElementById("waitingOverlay");
    if (overlay) {
      overlay.style.display = "none";
    }
  }

  private updateConnectionStatus(
    status: "connected" | "connecting" | "disconnected",
    text: string
  ): void {
    const indicator = document.getElementById("connectionIndicator");
    const statusText = document.getElementById("connectionStatus");

    if (indicator) {
      indicator.className = `w-2 h-2 rounded-full ${
        status === "connected"
          ? "bg-green-400"
          : status === "connecting"
          ? "bg-yellow-400 animate-pulse"
          : "bg-red-400"
      }`;
    }

    if (statusText) {
      statusText.textContent = text;
    }
  }

  private exitToSetup(): void {
    localStorage.removeItem("currentMatchAuth");
    navigateSpa("/tournament");
  }

  public cleanup(): void {
    this.stopGameLoop();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    window.removeEventListener("keydown", () => {});
    window.removeEventListener("keyup", () => {});

    console.log("🎮 Tournament Play Manager cleaned up");
  }
}
