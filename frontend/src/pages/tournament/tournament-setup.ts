// Tournament Setup Manager - Handles tournament creation and joining
import { io, Socket } from "socket.io-client";
import { showPopupNotification } from "../../notification";
import { navigateSpa } from "../../shared/navigation";

interface TournamentSummary {
  id: string;
  name: string;
  creatorUsername: string;
  playerCount: number;
  maxPlayers: number;
  status: "setup" | "active" | "completed";
  joinCode: string;
  winner?: {
    id: string;
    username: string;
  };
}

export class TournamentSetupManager {
  private socket: Socket | null = null;
  private currentUser: any = null;

  constructor() {
    console.log("🏆 Tournament Setup Manager initialized");
    this.loadCurrentUser();
    this.setupEventListeners();
    this.initializeSocket();
  }

  private loadCurrentUser(): void {
    try {
      const userString = localStorage.getItem("user");
      if (userString && userString !== "undefined") {
        this.currentUser = JSON.parse(userString);
        console.log("Current user loaded:", this.currentUser.username);
      }
    } catch (error) {
      console.error("Failed to load current user:", error);
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
      console.log("✅ Socket connected:", this.socket?.id);
      this.updateConnectionStatus("connected", "Connected");
      this.loadActiveTournaments();
    });

    this.socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      this.updateConnectionStatus("disconnected", "Disconnected");
    });

    this.socket.on("authenticated", (payload) => {
      if (payload?.success) {
        this.currentUser = payload.user;
        console.log("✅ Authenticated as:", payload.user?.username);
      }
    });

    this.setupSocketEventHandlers();
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    // Tournament created successfully
    this.socket.on("tournamentCreated", (data: { tournament: any }) => {
      console.log("✅ Tournament created:", data.tournament);
      showPopupNotification(
        `Tournament created! Code: ${data.tournament.joinCode}`,
        "success"
      );

      // Navigate to lobby
      navigateSpa(`/tournament/lobby?id=${data.tournament.id}`);
    });

    // Tournament joined successfully
    this.socket.on("tournamentJoined", (data: { tournament: any }) => {
      console.log("✅ Joined tournament:", data.tournament);
      showPopupNotification("Successfully joined tournament!", "success");

      // Navigate to lobby
      navigateSpa(`/tournament/lobby?id=${data.tournament.id}`);
    });

    // Tournament list received
    this.socket.on(
      "tournamentList",
      (data: { tournaments: TournamentSummary[] }) => {
        console.log("📋 Tournament list received:", data.tournaments);
        this.renderActiveTournaments(data.tournaments);
      }
    );

    // Tournament completed - refresh the list to show winner
    this.socket.on("tournamentCompleted", (data: { tournament: any }) => {
      console.log("🏆 Tournament completed:", data.tournament);
      showPopupNotification("Tournament completed!", "success");
      // Refresh the tournament list to show updated status
      this.loadActiveTournaments();
    });

    // Tournament updated - refresh the list
    this.socket.on("tournamentUpdated", () => {
      console.log("🔄 Tournament updated");
      this.loadActiveTournaments();
    });

    // Error handling
    this.socket.on("error", (data: { message: string }) => {
      console.error("❌ Socket error:", data.message);
      showPopupNotification(data.message, "error");
    });
  }

  private setupEventListeners(): void {
    // Create tournament form
    const createForm = document.getElementById(
      "createTournamentForm"
    ) as HTMLFormElement;
    createForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleCreateTournament();
    });

    // Join tournament form
    const joinForm = document.getElementById(
      "joinTournamentForm"
    ) as HTMLFormElement;
    joinForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleJoinTournament();
    });

    // Auto-uppercase join code
    const joinCodeInput = document.getElementById(
      "joinCode"
    ) as HTMLInputElement;
    joinCodeInput?.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      target.value = target.value.toUpperCase();
    });
  }

  private handleCreateTournament(): void {
    const nameInput = document.getElementById(
      "tournamentName"
    ) as HTMLInputElement;
    const sizeSelect = document.getElementById(
      "tournamentSize"
    ) as HTMLSelectElement;
    const matchTypeSelect = document.getElementById(
      "matchType"
    ) as HTMLSelectElement;

    const name = nameInput.value.trim();
    const size = parseInt(sizeSelect.value);
    const matchType = parseInt(matchTypeSelect.value);

    if (!name) {
      showPopupNotification("Please enter a tournament name", "error");
      return;
    }

    if (!this.socket || !this.socket.connected) {
      showPopupNotification("Not connected to server", "error");
      return;
    }

    console.log("Creating tournament:", { name, size, matchType });
    this.socket.emit("createTournament", { name, size, matchType });
  }

  private handleJoinTournament(): void {
    const joinCodeInput = document.getElementById(
      "joinCode"
    ) as HTMLInputElement;
    const joinCode = joinCodeInput.value.trim().toUpperCase();

    if (!joinCode || joinCode.length !== 6) {
      showPopupNotification(
        "Please enter a valid 6-character join code",
        "error"
      );
      return;
    }

    if (!this.socket || !this.socket.connected) {
      showPopupNotification("Not connected to server", "error");
      return;
    }

    console.log("Joining tournament with code:", joinCode);
    this.socket.emit("joinTournament", { joinCode });
  }

  private loadActiveTournaments(): void {
    if (this.socket && this.socket.connected) {
      console.log("📋 Requesting tournament list...");
      this.socket.emit("listTournaments");
    }
  }

  private renderActiveTournaments(tournaments: TournamentSummary[]): void {
    const container = document.getElementById("activeTournamentsList");
    if (!container) return;

    if (tournaments.length === 0) {
      container.innerHTML =
        '<p class="text-gray-500 text-center py-4">No active tournaments</p>';
      return;
    }

    container.innerHTML = tournaments
      .map((tournament) => {
        const isSetup = tournament.status === "setup";
        const isActive = tournament.status === "active";
        const isCompleted = tournament.status === "completed";

        // Status badge color
        const statusColor = isSetup
          ? "bg-blue-600"
          : isActive
          ? "bg-green-600"
          : "bg-yellow-600";
        const statusText = isSetup
          ? "Setup"
          : isActive
          ? "In Progress"
          : "Completed";

        return `
					<div class="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-purple-500 transition ${
            isSetup ? "cursor-pointer" : ""
          }"
						 ${
               isSetup
                 ? `data-tournament-id="${tournament.id}" data-join-code="${tournament.joinCode}"`
                 : ""
             }>
						<div class="flex items-center justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-2 mb-1">
									<h4 class="font-semibold text-white">${this.escapeHtml(tournament.name)}</h4>
									<span class="text-xs px-2 py-0.5 ${statusColor} text-white rounded-full">${statusText}</span>
								</div>
								<p class="text-sm text-gray-400">
									${tournament.playerCount}/${tournament.maxPlayers} players
									${isSetup ? ` • Code: ${tournament.joinCode}` : ""}
								</p>
								<p class="text-xs text-gray-500">By ${this.escapeHtml(
                  tournament.creatorUsername
                )}</p>
								${
                  isCompleted && tournament.winner
                    ? `
									<p class="text-sm text-yellow-400 mt-1">
										🏆 Champion: ${this.escapeHtml(tournament.winner.username)}
									</p>
								`
                    : ""
                }
							</div>
							${
                isSetup
                  ? `
								<button 
									class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition"
									onclick="event.stopPropagation();">
									Join
								</button>
							`
                  : isActive || isCompleted
                  ? `
								<button 
									class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-lg transition"
									onclick="window.location.href='/tournament/brackets?id=${tournament.id}'">
									${isActive ? "Watch" : "View Results"}
								</button>
							`
                  : ""
              }
						</div>
					</div>
				`;
      })
      .join("");

    // Add click handlers for join buttons on setup tournaments
    container.querySelectorAll("[data-tournament-id]").forEach((element) => {
      const button = element.querySelector("button");
      button?.addEventListener("click", () => {
        const joinCode = element.getAttribute("data-join-code");
        if (joinCode) {
          const joinCodeInput = document.getElementById(
            "joinCode"
          ) as HTMLInputElement;
          if (joinCodeInput) {
            joinCodeInput.value = joinCode;
            this.handleJoinTournament();
          }
        }
      });
    });
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
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    console.log("🏆 Tournament Setup Manager cleaned up");
  }
}
