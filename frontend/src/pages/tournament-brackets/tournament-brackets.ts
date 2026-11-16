// Tournament Brackets Manager - Handles bracket visualization and match result processing
import { io, Socket } from 'socket.io-client';
import { showPopupNotification } from '../../notification';
import { navigateSpa } from '../../shared/navigation';

interface TournamentPlayer {
	id: string;
	username: string;
	eliminated?: boolean;
	isAI?: boolean;
}

interface TournamentMatch {
	id: string;
	player1: TournamentPlayer | null;
	player2: TournamentPlayer | null;
	winner: TournamentPlayer | null;
	round: number;
	matchIndex: number;
	completed: boolean;
	roomId?: string;
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
	status: 'setup' | 'active' | 'completed';
	winner: TournamentPlayer | null;
}

export class TournamentBracketsManager {
	private socket: Socket | null = null;
	private tournamentId: string | null = null;
	private currentUser: any = null;
	private tournament: Tournament | null = null;

	constructor() {
		console.log('🏆 Tournament Brackets Manager initialized');
		this.loadCurrentUser();
		this.getTournamentIdFromUrl();
		this.setupEventListeners();
		this.initializeSocket();
		this.checkForMatchResult();
	}

	private loadCurrentUser(): void {
		try {
			const userString = localStorage.getItem('user');
			if (userString && userString !== 'undefined') {
				this.currentUser = JSON.parse(userString);
			}
		} catch (error) {
			console.error('Failed to load current user:', error);
		}
	}

	private getTournamentIdFromUrl(): void {
		const params = new URLSearchParams(window.location.search);
		this.tournamentId = params.get('id');
		
		if (!this.tournamentId) {
			showPopupNotification('No tournament ID provided', 'error');
			navigateSpa('/tournament');
		}
	}

	private initializeSocket(): void {

		const socketUrl = window.location.protocol === 'https:'
			? `wss://${window.location.host}`
			: `ws://${window.location.host}`;

		this.socket = io(socketUrl, {
			path: '/socket.io',
			transports: ['websocket', 'polling'],
			secure: window.location.protocol === 'https:',
			withCredentials: true
		});

		this.socket.on('connect', () => {
			console.log('✅ Brackets: Socket connected, requesting tournament data');
			this.updateConnectionStatus('connected', 'Connected');
			this.spectateTournament();
		});

		this.socket.on('authenticated', (payload: any) => {
			console.log('✅ Brackets: Socket authenticated:', payload.user?.username);
			if (payload?.success) {
				this.currentUser = payload.user;
				console.log('🎯 Requesting tournament after authentication');
				this.spectateTournament();
			}
		});

		this.socket.on('disconnect', () => {
			console.log('❌ Socket disconnected');
			this.updateConnectionStatus('disconnected', 'Disconnected');
		});

		this.setupSocketEventHandlers();

		// Fallback: Request tournament data after delay
		setTimeout(() => {
			if (this.socket && this.socket.connected && this.tournamentId && !this.tournament) {
				console.log('🔄 Fallback: Requesting tournament data...');
				this.spectateTournament();
			}
		}, 1000);
	}

	private setupSocketEventHandlers(): void {
		if (!this.socket) return;

		// Tournament spectating - initial data when spectating
		this.socket.on('tournamentSpectating', (data: { tournament: Tournament }) => {
			console.log('👁️ Now spectating tournament:', data.tournament);
			this.tournament = data.tournament;
			this.renderTournamentInfo();
			this.renderBrackets();
		});

		// Tournament updated - real-time updates
		this.socket.on('tournamentUpdated', (data: { tournament: Tournament }) => {
			console.log('🔄 Tournament updated:', data.tournament);
			this.tournament = data.tournament;
			this.renderTournamentInfo();
			this.renderBrackets();
		});

		// Tournament match completed - when a match finishes
		this.socket.on('tournamentMatchCompleted', (data: { tournament: Tournament }) => {
			console.log('✅ Match completed, tournament updated:', data.tournament);
			this.tournament = data.tournament;
			this.renderTournamentInfo();
			this.renderBrackets();
		});

		// Tournament completed - when tournament finishes
		this.socket.on('tournamentCompleted', (data: { tournament: Tournament }) => {
			console.log('🏆 Tournament completed!', data.tournament);
			this.tournament = data.tournament;
			this.renderTournamentInfo();
			this.renderBrackets();
			showPopupNotification('Tournament completed!', 'success');
		});

		// Error handling
		this.socket.on('error', (data: any) => {
			const errorMessage = typeof data === 'string' ? data : (data?.message || 'Unknown error');
			console.error('❌ Error:', errorMessage);
			showPopupNotification(errorMessage, 'error');
		});
	}

	private setupEventListeners(): void {
		// Refresh button
		const refreshBtn = document.getElementById('refreshBtn');
		refreshBtn?.addEventListener('click', () => this.spectateTournament());
	}

	private spectateTournament(): void {
		if (!this.socket || !this.tournamentId) return;
		
		console.log('👁️ Spectating tournament:', this.tournamentId);
		this.socket.emit('spectateTournament', { tournamentId: this.tournamentId });
	}

	private checkForMatchResult(): void {
		const matchResult = localStorage.getItem('tournamentMatchResult');
		if (matchResult) {
			try {
				const result = JSON.parse(matchResult);
				console.log('🏆 Found match result:', result);
				
				// Report result to server with winnerId (not winner username)
				if (this.socket && result.matchData && result.winnerId) {
					this.socket.emit('tournamentMatchResult', {
						tournamentId: result.matchData.tournamentId,
						matchId: result.matchData.matchId,
						winnerId: result.winnerId,
						finalScore: result.finalScore
					});
				}
				
				// Clear the result
				localStorage.removeItem('tournamentMatchResult');
			} catch (e) {
				console.error('Failed to process match result:', e);
			}
		}
	}

	private renderTournamentInfo(): void {
		if (!this.tournament) return;

		const nameEl = document.getElementById('tournamentName');
		const statusEl = document.getElementById('tournamentStatus');
		const roundEl = document.getElementById('currentRound');
		const playersEl = document.getElementById('totalPlayers');
		const championEl = document.getElementById('champion');

		if (nameEl) nameEl.textContent = this.tournament.name;
		if (statusEl) {
			statusEl.textContent = this.tournament.status === 'active' ? 'Active' : 
								   this.tournament.status === 'completed' ? 'Completed' : 'Setup';
			statusEl.className = `text-lg font-bold ${
				this.tournament.status === 'active' ? 'text-green-400' :
				this.tournament.status === 'completed' ? 'text-yellow-400' :
				'text-gray-400'
			}`;
		}
		if (roundEl) roundEl.textContent = `Round ${this.tournament.currentRound} of ${this.tournament.rounds}`;
		if (playersEl) playersEl.textContent = this.tournament.size.toString();
		if (championEl && this.tournament.winner) {
			championEl.textContent = this.tournament.winner.username;
		}
	}

	private renderBrackets(): void {
		console.log('🎨 Rendering brackets, tournament:', this.tournament);
		
		if (!this.tournament) {
			console.warn('⚠️ Cannot render brackets: no tournament data');
			return;
		}

		const container = document.getElementById('bracketsContainer');
		if (!container) {
			console.error('❌ Brackets container not found');
			return;
		}

		console.log(`📊 Tournament has ${this.tournament.matches?.length || 0} matches`);

		// Check if matches exist
		if (!this.tournament.matches || this.tournament.matches.length === 0) {
			container.innerHTML = `
				<div class="text-center py-12">
					<p class="text-yellow-400 text-xl mb-2">⚠️ No matches generated yet</p>
					<p class="text-gray-400">Tournament may still be initializing...</p>
					<button onclick="location.reload()" class="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
						Refresh Page
					</button>
				</div>
			`;
			return;
		}

		// Group matches by round
		const matchesByRound: { [round: number]: TournamentMatch[] } = {};
		this.tournament.matches.forEach(match => {
			if (!matchesByRound[match.round]) {
				matchesByRound[match.round] = [];
			}
			matchesByRound[match.round].push(match);
		});

		console.log('📋 Matches by round:', matchesByRound);

		// Generate bracket HTML
		container.innerHTML = `
			<div class="flex gap-8 justify-center">
				${Object.keys(matchesByRound)
					.sort((a, b) => parseInt(a) - parseInt(b))
					.map(round => {
						const roundNum = parseInt(round);
						const matches = matchesByRound[roundNum];
						const roundName = this.getRoundName(roundNum, this.tournament!.rounds);
						
						return `
							<div class="flex-shrink-0">
								<h3 class="text-xl font-bold text-center mb-4 text-cyan-400">${roundName}</h3>
								<div class="space-y-6">
									${matches.map(match => this.renderMatch(match)).join('')}
								</div>
							</div>
						`;
					})
					.join('')}
			</div>
		`;

		// Add event listeners for "Play Match" buttons
		container.querySelectorAll('[data-match-id]').forEach(button => {
			button.addEventListener('click', (e) => {
				const matchId = (e.target as HTMLElement).getAttribute('data-match-id');
				const roomId = (e.target as HTMLElement).getAttribute('data-room-id');
				if (matchId && roomId) {
					this.handlePlayMatch(matchId, roomId);
				}
			});
		});

		// Add event listeners for "Spectate Match" buttons
		container.querySelectorAll('[data-spectate-match-id]').forEach(button => {
			button.addEventListener('click', (e) => {
				const matchId = (e.target as HTMLElement).getAttribute('data-spectate-match-id');
				const roomId = (e.target as HTMLElement).getAttribute('data-spectate-room-id');
				if (matchId && roomId) {
					this.handleSpectateMatch(matchId, roomId);
				}
			});
		});
	}

	private renderMatch(match: TournamentMatch): string {
		const p1 = match.player1;
		const p2 = match.player2;
		const winner = match.winner;
		
		const isP1Winner = winner && p1 && winner.id === p1.id;
		const isP2Winner = winner && p2 && winner.id === p2.id;
		
		const canPlay = this.canPlayMatch(match);
		const canSpectate = this.canSpectateMatch(match);

		return `
			<div class="bg-gray-800 border ${match.completed ? 'border-green-500' : 'border-gray-600'} rounded-lg p-4 min-w-[250px]">
				<!-- Player 1 -->
				<div class="flex items-center justify-between p-2 rounded ${isP1Winner ? 'bg-green-900/30' : 'bg-gray-900'}">
					<span class="text-white font-semibold">${p1 ? this.escapeHtml(p1.username) : 'TBD'}</span>
					${isP1Winner ? '<span class="text-green-400">✓</span>' : ''}
				</div>
				
				<div class="my-2 text-center text-gray-500 text-xs">VS</div>
				
				<!-- Player 2 -->
				<div class="flex items-center justify-between p-2 rounded ${isP2Winner ? 'bg-green-900/30' : 'bg-gray-900'}">
					<span class="text-white font-semibold">${p2 ? this.escapeHtml(p2.username) : 'TBD'}</span>
					${isP2Winner ? '<span class="text-green-400">✓</span>' : ''}
				</div>

				${canPlay ? `
					<button 
						class="w-full mt-3 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-bold rounded transition"
						data-match-id="${match.id}"
						data-room-id="${match.roomId}"
					>
						Play Match
					</button>
				` : canSpectate ? `
					<button 
						class="w-full mt-3 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold rounded transition"
						data-spectate-match-id="${match.id}"
						data-spectate-room-id="${match.roomId}"
					>
						👁️ Spectate Match
					</button>
				` : match.completed ? `
					<div class="mt-3 text-center text-green-400 text-sm font-semibold">
						✓ Completed
					</div>
				` : `
					<div class="mt-3 text-center text-gray-500 text-sm">
						Waiting for players...
					</div>
				`}
			</div>
		`;
	}

	private canPlayMatch(match: TournamentMatch): boolean {
		if (!this.currentUser || match.completed) return false;
		
		// Check if current user is one of the players
		const isPlayer = 
			(match.player1 && match.player1.id === this.currentUser.id.toString()) ||
			(match.player2 && match.player2.id === this.currentUser.id.toString());
		
		// Check if both players are assigned
		const bothPlayersReady = match.player1 && match.player2;
		
		return !!isPlayer && !!bothPlayersReady && !match.completed;
	}

	private canSpectateMatch(match: TournamentMatch): boolean {
		if (!this.currentUser || match.completed) return false;
		
		// Check if current user is NOT one of the players
		const isPlayer = 
			(match.player1 && match.player1.id === this.currentUser.id.toString()) ||
			(match.player2 && match.player2.id === this.currentUser.id.toString());
		
		// Check if both players are assigned and room exists
		const bothPlayersReady = match.player1 && match.player2;
		const hasRoomId = match.roomId && match.roomId !== 'undefined';
		
		// Can spectate if: not a player, both players ready, has room, and match in progress
		return !isPlayer && !!bothPlayersReady && !!hasRoomId && !match.completed;
	}

	private handlePlayMatch(matchId: string, roomId: string): void {
		if (!this.tournamentId) return;

		// Validate roomId exists
		if (!roomId || roomId === 'undefined') {
			console.error('❌ Cannot start match: roomId is missing');
			showPopupNotification('Match room not ready. Please wait for tournament to initialize.', 'error');
			return;
		}

		console.log('🎮 Starting match:', { tournamentId: this.tournamentId, matchId, roomId });

		// Store match authorization
		const matchAuth = {
			tournamentId: this.tournamentId,
			matchId: matchId,
			roomId: roomId,
			timestamp: Date.now()
		};
		localStorage.setItem('currentMatchAuth', JSON.stringify(matchAuth));

		// Navigate to play page
		const params = new URLSearchParams({
			tournamentId: this.tournamentId,
			matchId: matchId,
			roomId: roomId
		});
		
		navigateSpa(`/tournament/play?${params.toString()}`);
	}

	private handleSpectateMatch(matchId: string, roomId: string): void {
		if (!this.tournamentId) return;

		// Validate roomId exists
		if (!roomId || roomId === 'undefined') {
			console.error('❌ Cannot spectate match: roomId is missing');
			showPopupNotification('Match room not ready. Please try again later.', 'error');
			return;
		}

		console.log('👁️ Spectating match:', { tournamentId: this.tournamentId, matchId, roomId });

		// Navigate to play page in spectate mode
		const params = new URLSearchParams({
			tournamentId: this.tournamentId,
			matchId: matchId,
			roomId: roomId,
			spectate: 'true'
		});
		
		navigateSpa(`/tournament/play?${params.toString()}`);
	}

	private getRoundName(round: number, totalRounds: number): string {
		const roundsFromEnd = totalRounds - round + 1;
		
		if (roundsFromEnd === 1) return 'Finals';
		if (roundsFromEnd === 2) return 'Semi-Finals';
		if (roundsFromEnd === 3) return 'Quarter-Finals';
		
		return `Round ${round}`;
	}

	private updateConnectionStatus(status: 'connected' | 'connecting' | 'disconnected', text: string): void {
		const indicator = document.getElementById('connectionIndicator');
		const statusText = document.getElementById('connectionStatus');

		if (indicator) {
			indicator.className = `w-2 h-2 rounded-full ${
				status === 'connected' ? 'bg-green-400' :
				status === 'connecting' ? 'bg-yellow-400 animate-pulse' :
				'bg-red-400'
			}`;
		}

		if (statusText) {
			statusText.textContent = text;
		}
	}

	private escapeHtml(unsafe: string): string {
		return unsafe
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	public cleanup(): void {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
		console.log('🏆 Tournament Brackets Manager cleaned up');
	}
}
