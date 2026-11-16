// Tournament Lobby Manager - Handles lobby state and player management
import { io, Socket } from "socket.io-client";
import { showPopupNotification } from "../../notification";
import { navigateSpa } from "../../shared/navigation";

interface TournamentPlayer {
  id: string;
  username: string;
  isAI?: boolean;
}

interface Tournament {
  id: string;
  name: string;
  creatorId: number;
  joinCode: string;
  players: TournamentPlayer[];
  size: number;
  status: "setup" | "active" | "completed";
}

export class TournamentLobbyManager {
  private socket: Socket | null = null;
  private tournamentId: string | null = null;
  private currentUser: any = null;
  private tournament: Tournament | null = null;
  private joinRetryTimers: number[] = []; // Store timer IDs to cancel them

  constructor() {
    console.log("🎮 Tournament Lobby Manager initialized");
    this.loadCurrentUser();
    this.getTournamentIdFromUrl();
    this.setupEventListeners();
    this.initializeSocket();
  }

  private loadCurrentUser(): void {
    try {
      const userString = localStorage.getItem("user");
      if (userString && userString !== "undefined") {
        this.currentUser = JSON.parse(userString);
      }
    } catch (error) {
      console.error("Failed to load current user:", error);
    }
  }

  private getTournamentIdFromUrl(): void {
    const params = new URLSearchParams(window.location.search);
    this.tournamentId = params.get("id");

    if (!this.tournamentId) {
      showPopupNotification("No tournament ID provided", "error");
      navigateSpa("/tournament");
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
      console.log("✅ Socket connected - waiting for authentication");
      this.updateConnectionStatus("connected", "Connected");
    });

    this.socket.on("authenticated", (payload: any) => {
      console.log("✅ Socket authenticated:", payload.user?.username);
      if (payload?.success) {
        this.currentUser = payload.user;
        console.log("🎯 Attempting to join tournament after authentication");
        this.joinTournamentRoom();
      }
    });

    this.socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      this.updateConnectionStatus("disconnected", "Disconnected");
    });

    this.setupSocketEventHandlers();

    // Multiple fallback attempts to ensure joining happens
    const timer1 = window.setTimeout(() => {
      if (
        this.socket &&
        this.socket.connected &&
        this.tournamentId &&
        !this.tournament
      ) {
        console.log("🔄 Fallback attempt 1: Joining tournament...");
        this.joinTournamentRoom();
      }
    }, 500);

    const timer2 = window.setTimeout(() => {
      if (
        this.socket &&
        this.socket.connected &&
        this.tournamentId &&
        !this.tournament
      ) {
        console.log(
          "🔄 Fallback attempt 2: Tournament not loaded, retrying join..."
        );
        this.joinTournamentRoom();
      }
    }, 1500);

    const timer3 = window.setTimeout(() => {
      if (
        this.socket &&
        this.socket.connected &&
        this.tournamentId &&
        !this.tournament
      ) {
        console.log("🔄 Fallback attempt 3: Final retry to join tournament...");
        this.joinTournamentRoom();
      }
    }, 3000);

    // Store timer IDs so we can cancel them if we join successfully
    this.joinRetryTimers = [timer1, timer2, timer3];
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    // Tournament joined - initial data when joining
    this.socket.on("tournamentJoined", (data: { tournament: Tournament }) => {
      console.log("✅ Joined tournament:", data.tournament);
      this.tournament = data.tournament;

      // Cancel any pending retry timers since we successfully joined
      this.cancelRetryTimers();

      this.renderTournamentInfo();
      this.renderPlayers();
      this.updateStartButton();
    });

    // Tournament player joined - when another player joins
    this.socket.on(
      "tournamentPlayerJoined",
      (data: { tournament: Tournament; player: any }) => {
        console.log("👥 Player joined:", data.player.username);
        this.tournament = data.tournament;
        this.renderTournamentInfo();
        this.renderPlayers();
        this.updateStartButton();
      }
    );

    // Tournament updated - general updates
    this.socket.on("tournamentUpdated", (data: { tournament: Tournament }) => {
      console.log("🔄 Tournament updated:", data.tournament);
      this.tournament = data.tournament;
      this.renderTournamentInfo();
      this.renderPlayers();
      this.updateStartButton();
    });

    // Tournament started
    this.socket.on("tournamentStarted", (data: { tournament: Tournament }) => {
      console.log("🎉 Tournament started!");
      showPopupNotification("Tournament is starting!", "success");
      // Navigate to brackets page
      navigateSpa(`/tournament/brackets?id=${data.tournament.id}`);
    });

    // Tournament completed - update data when tournament finishes
    this.socket.on(
      "tournamentCompleted",
      (data: { tournament: Tournament }) => {
        console.log("🏆 Tournament completed!", data.tournament);
        this.tournament = data.tournament;
        this.renderTournamentInfo();
        this.renderPlayers();
        showPopupNotification("Tournament completed!", "success");
      }
    );

    // Error handling
    this.socket.on("error", (data: any) => {
      const errorMessage =
        typeof data === "string" ? data : data?.message || "Unknown error";
      console.error("❌ Error:", errorMessage);
      showPopupNotification(errorMessage, "error");
    });
  }

  private setupEventListeners(): void {
    // Leave lobby button
    const leaveBtn = document.getElementById("leaveLobbyBtn");
    leaveBtn?.addEventListener("click", () => this.handleLeaveLobby());

    // Start tournament button
    const startBtn = document.getElementById("startTournamentBtn");
    startBtn?.addEventListener("click", () => this.handleStartTournament());
  }

  private joinTournamentRoom(): void {
    if (!this.socket || !this.tournamentId) return;

    console.log("Joining tournament:", this.tournamentId);
    this.socket.emit("joinTournament", { tournamentId: this.tournamentId });
  }

  private cancelRetryTimers(): void {
    // Clear all pending retry timers
    this.joinRetryTimers.forEach((timer) => clearTimeout(timer));
    this.joinRetryTimers = [];
    console.log("🚫 Cancelled retry timers - successfully joined tournament");
  }

  private handleLeaveLobby(): void {
    if (this.socket) {
      this.socket.emit("leaveTournament");
    }
    navigateSpa("/tournament");
  }

  private handleStartTournament(): void {
    if (!this.socket || !this.tournamentId) return;

    console.log("Starting tournament:", this.tournamentId);
    this.socket.emit("startTournament", { tournamentId: this.tournamentId });
  }

  private renderTournamentInfo(): void {
    if (!this.tournament) return;

    const nameEl = document.getElementById("tournamentName");
    const codeEl = document.getElementById("joinCode");
    const countEl = document.getElementById("playerCount");

    if (nameEl) nameEl.textContent = this.tournament.name;
    if (codeEl) codeEl.textContent = this.tournament.joinCode;
    if (countEl)
      countEl.textContent = `${this.tournament.players.length}/${this.tournament.size}`;
  }

  private renderPlayers(): void {
    if (!this.tournament) return;

    const container = document.getElementById("playersGrid");
    if (!container) return;

    const totalSlots = this.tournament.size;
    const players = this.tournament.players;

    container.innerHTML = "";

    for (let i = 0; i < totalSlots; i++) {
      const player = players[i];
      const slot = document.createElement("div");

      if (player) {
        slot.className =
          "bg-gray-800 border-2 border-green-500 rounded-lg p-4 text-center";
        slot.innerHTML = `
					<div class="w-16 h-16 mx-auto mb-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 flex items-center justify-center text-2xl">
						${player.isAI ? "🤖" : "👤"}
					</div>
					<p class="font-semibold text-white">${this.escapeHtml(player.username)}</p>
					<p class="text-xs text-gray-400">${player.isAI ? "AI Player" : "Human"}</p>
				`;
      } else {
        slot.className =
          "bg-gray-800/30 border-2 border-dashed border-gray-600 rounded-lg p-4 text-center";
        slot.innerHTML = `
					<div class="w-16 h-16 mx-auto mb-2 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
						❓
					</div>
					<p class="font-semibold text-gray-500">Waiting...</p>
					<p class="text-xs text-gray-600">Slot ${i + 1}</p>
				`;
      }

      container.appendChild(slot);
    }
  }

  private updateStartButton(): void {
    if (!this.tournament || !this.currentUser) return;

    const startBtn = document.getElementById(
      "startTournamentBtn"
    ) as HTMLButtonElement;
    const messageEl = document.getElementById("startBtnMessage");

    if (!startBtn || !messageEl) return;

    const isCreator = this.tournament.creatorId === this.currentUser.id;
    const isFull = this.tournament.players.length === this.tournament.size;

    if (isCreator) {
      startBtn.classList.remove("hidden");
      messageEl.classList.remove("hidden");

      if (isFull) {
        startBtn.disabled = false;
        messageEl.textContent = "All players ready! Click to start.";
        messageEl.className = "mt-2 text-green-400 text-sm";
      } else {
        startBtn.disabled = true;
        messageEl.textContent = `Waiting for ${
          this.tournament.size - this.tournament.players.length
        } more players...`;
        messageEl.className = "mt-2 text-gray-400 text-sm";
      }
    } else {
      startBtn.classList.add("hidden");
      messageEl.classList.remove("hidden");
      messageEl.textContent = "Waiting for tournament creator to start...";
      messageEl.className = "mt-2 text-gray-400 text-sm";
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

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  public cleanup(): void {
    // Cancel any pending retry timers
    this.cancelRetryTimers();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    console.log("🎮 Tournament Lobby Manager cleaned up");
  }
}
