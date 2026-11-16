import { io, Socket } from 'socket.io-client';
import { GAME_CONSTANTS } from '../game/game-constants';
import { navigateSpa } from '../../shared/navigation';
import { authFetch } from '../../shared/auth';

interface Player {
	id: string;
	username: string;
	score: number;
	ready: boolean;
	paddle?: {
		y: number;
		speed: number;
	};
}

interface GameInvitation {
	id: number;
	room_code: string;
	sender_username: string;
	sender_display_name?: string;
}

interface GameState {
	ball: {
		x: number;
		y: number;
		vx: number;
		vy: number;
	};
	players: Player[];
}

class OnlineGameClient {
	private socket: Socket | null = null;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private gameState: GameState | null = null;
	private currentPlayer: Player | null = null;
	private roomId: string | null = null;
	private gameSettings = {
		width: GAME_CONSTANTS.CANVAS.WIDTH,
		height: GAME_CONSTANTS.CANVAS.HEIGHT,
		paddleWidth: GAME_CONSTANTS.PADDLE.WIDTH,
		paddleHeight: GAME_CONSTANTS.PADDLE.HEIGHT,
		ballSize: GAME_CONSTANTS.BALL.RADIUS * 2,
		maxScore: GAME_CONSTANTS.GAME.WINNING_SCORE
	};

	// Performance optimization: Client-side interpolation
	private lastServerUpdate: number = 0;
	private interpolatedBall: { x: number; y: number } | null = null;
	private lastBallState: { x: number; y: number; vx: number; vy: number; timestamp: number } | null = null;

	// UI Elements
	private waitingScreen: HTMLElement;
	private authPrompt: HTMLElement;
	private searchingScreen: HTMLElement;
	private roomScreen: HTMLElement;
	private gameCanvas: HTMLCanvasElement;
	private gameOverModal: HTMLElement;

	// Key states
	private keys: { [key: string]: boolean } = {};

	// Mobile controls
	private touchControls: boolean = false;
	private gameLoopId: number = 0;
	private reconnectAttempts: number = 0;
	private maxReconnectAttempts: number = 5;
	private tournamentMatch: boolean = false;
	private pendingJoinCode: string | null = null;
	private suggestionsInterval: number | null = null;
	private invitationInterval: number | null = null;
	private countdownActive: boolean = false;
	private countdownValue: number = 0;

	constructor() {
		// Get UI elements with proper null checks
		this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
		if (!this.canvas) {
			console.error('❌ gameCanvas element not found in DOM!');
			throw new Error('Required gameCanvas element not found');
		}
		this.ctx = this.canvas.getContext('2d')!;

		// Set proper canvas size to match game settings
		this.canvas.width = this.gameSettings.width;
		this.canvas.height = this.gameSettings.height;

		// Get UI elements
		this.waitingScreen = document.getElementById('waitingScreen')!;
		this.authPrompt = document.getElementById('authPrompt')!;
		this.searchingScreen = document.getElementById('searchingScreen')!;
		this.roomScreen = document.getElementById('roomScreen')!;
		this.gameCanvas = this.canvas; // Use the same canvas reference
		this.gameOverModal = document.getElementById('gameOverModal')!;

		this.init();
	}

	private async init() {
		this.setupEventListeners();

		const cachedUser = localStorage.getItem('user');
		const userPresent = Boolean(cachedUser && cachedUser !== 'undefined');

		console.log('✅ Auth check - user present:', userPresent);

		if (!userPresent) {
			this.showAuthPrompt();
			this.disableGameButtons();
			return;
		}

		this.showWaitingScreen();
		this.connectToServer();
		this.handleTournamentParameters();
	}

	private handleTournamentParameters() {
		const urlParams = new URLSearchParams(window.location.search);
		const roomId = urlParams.get('room');
		const isTournament = urlParams.get('tournament') === 'true';
		const codeParam = urlParams.get('code');

		this.tournamentMatch = Boolean(roomId && isTournament);

		if (this.tournamentMatch && roomId) {
			console.log('🏆 Tournament match detected:', { roomId, isTournament });
			this.roomId = decodeURIComponent(roomId); // Decode the room ID

			// Wait for socket connection AND authentication before joining
			const waitForAuth = () => {
				if (this.socket?.connected && this.currentPlayer) {
					console.log('✅ Socket connected and authenticated, joining tournament room');
					this.joinTournamentRoom(this.roomId!);
				} else {
					console.log('⏳ Waiting for socket connection and auth...');
					setTimeout(waitForAuth, 100);
				}
			};
			waitForAuth();
			return;
		}

		if (codeParam) {
			this.pendingJoinCode = codeParam.toUpperCase();
			this.showMessage(`Joining room ${this.pendingJoinCode}...`, 'info');
		}
	}

	private joinTournamentRoom(roomId: string) {
		if (!this.socket || !this.socket.connected) {
			console.error('❌ Cannot join tournament room: socket not connected');
			this.showMessage('Connection error. Please refresh and try again.', 'error');
			return;
		}

		console.log('🏆 Emitting joinRoom event for tournament room:', roomId);
		console.log('🔍 Socket connected:', this.socket.connected);
		console.log('🔍 Current player:', this.currentPlayer);

		this.socket.emit('joinRoom', { roomId });

		// Show appropriate screen while waiting
		this.showSearchingScreen();
		this.showMessage('Joining tournament match...', 'info');

		// Set timeout to detect if join failed
		setTimeout(() => {
			// If still on searching screen after 5 seconds, something went wrong
			if (this.searchingScreen.style.display !== 'none') {
				console.error('❌ Tournament room join timeout - no response from server');
				this.showMessage('Failed to join tournament match. Check console for details.', 'error');
			}
		}, 5000);
	}

	private setupEventListeners() {
		document.getElementById('createPrivateBtn')?.addEventListener('click', () => {
			this.createPrivateRoom();
		});

		const joinInput = document.getElementById('roomCodeInput') as HTMLInputElement | null;
		document.getElementById('joinByCodeBtn')?.addEventListener('click', () => {
			const code = joinInput?.value.trim().toUpperCase();
			if (code) {
				this.joinRoomByCode(code);
			} else {
				this.showMessage('Enter a join code to continue.', 'error');
			}
		});

		joinInput?.addEventListener('keypress', (event) => {
			if (event.key === 'Enter') {
				const code = joinInput.value.trim().toUpperCase();
				if (code) this.joinRoomByCode(code);
			}
		});

		document.getElementById('refreshRoomsBtn')?.addEventListener('click', () => {
			this.refreshSuggestedGames();
		});

		document.getElementById('findGameBtn')?.addEventListener('click', () => {
			this.findGame();
		});

		document.getElementById('cancelSearchBtn')?.addEventListener('click', () => {
			this.cancelSearch();
		});

		document.getElementById('readyBtn')?.addEventListener('click', () => {
			this.setPlayerReady();
		});

		document.getElementById('copyRoomCodeBtn')?.addEventListener('click', () => {
			const roomCode = (document.getElementById('roomCodeText') as HTMLElement | null)?.textContent;
			if (roomCode) {
				navigator.clipboard.writeText(roomCode).then(() => {
					this.showMessage('Room code copied to clipboard!', 'info');
				});
			}
		});

		const inviteList = document.getElementById('game-invite-list');
		inviteList?.addEventListener('click', (event) => {
			const target = event.target as HTMLElement;
			const acceptBtn = target.closest('[data-accept-invite]');
			const declineBtn = target.closest('[data-decline-invite]');

			if (acceptBtn) {
				const inviteId = Number(acceptBtn.getAttribute('data-accept-invite'));
				const code = acceptBtn.getAttribute('data-room-code') || '';
				if (inviteId && code) {
					this.acceptGameInvitation(inviteId, code);
				}
			}

			if (declineBtn) {
				const inviteId = Number(declineBtn.getAttribute('data-decline-invite'));
				if (inviteId) {
					this.declineGameInvitation(inviteId);
				}
			}
		});

		// Game Over modal buttons
		document.getElementById('playAgainBtn')?.addEventListener('click', () => {
			this.playAgain();
		});

		document.getElementById('backToMenuBtn')?.addEventListener('click', () => {
			// Use SPA route instead of legacy HTML
			navigateSpa('/dashboard');
		});

		// Keyboard controls
		document.addEventListener('keydown', (e) => {
			this.keys[e.key.toLowerCase()] = true;
			this.handleKeyPress(e.key);
		});

		document.addEventListener('keyup', (e) => {
			this.keys[e.key.toLowerCase()] = false;
			if (e.key === 'w' || e.key === 's' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
				this.sendPlayerMove('stop');
			}
		});

		// Prevent page scrolling with arrow keys
		document.addEventListener('keydown', (e) => {
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
				e.preventDefault();
			}
		});

		// Mobile touch controls
		this.setupMobileControls();

		// Window visibility handling for reconnection
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible' && this.socket?.disconnected) {
				this.attemptReconnection();
			}
		});
	}

	private setupMobileControls() {
		// Detect mobile device
		const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

		if (isMobile) {
			this.touchControls = true;
			this.createMobileControlButtons();
		}

		// Touch controls for canvas (paddle movement)
		this.canvas.addEventListener('touchstart', (e) => {
			e.preventDefault();
			this.handleTouch(e);
		}, { passive: false });

		this.canvas.addEventListener('touchmove', (e) => {
			e.preventDefault();
			this.handleTouch(e);
		}, { passive: false });

		this.canvas.addEventListener('touchend', (e) => {
			e.preventDefault();
			this.sendPlayerMove('stop');
		}, { passive: false });
	}

	private createMobileControlButtons() {
		const controlsContainer = document.createElement('div');
		controlsContainer.id = 'mobileControls';
		controlsContainer.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4 z-50';
		controlsContainer.style.display = 'none';

		const upBtn = this.createMobileButton('↑', () => this.sendPlayerMove('up'));
		const downBtn = this.createMobileButton('↓', () => this.sendPlayerMove('down'));

		controlsContainer.appendChild(upBtn);
		controlsContainer.appendChild(downBtn);
		document.body.appendChild(controlsContainer);
	}

	private createMobileButton(text: string, action: () => void): HTMLButtonElement {
		const button = document.createElement('button');
		button.textContent = text;
		button.className = 'w-16 h-16 bg-cyan-500/80 border-2 border-cyan-400 rounded-lg text-white text-2xl font-bold backdrop-blur-sm active:bg-cyan-400 transition-colors';

		button.addEventListener('touchstart', (e) => {
			e.preventDefault();
			action();
		}, { passive: false });

		button.addEventListener('touchend', (e) => {
			e.preventDefault();
			this.sendPlayerMove('stop');
		}, { passive: false });

		return button;
	}

	private handleTouch(e: TouchEvent) {
		if (!this.gameState || !this.currentPlayer) return;

		const touch = e.touches[0];
		const rect = this.canvas.getBoundingClientRect();
		const touchY = touch.clientY - rect.top;
		const canvasY = (touchY / rect.height) * this.canvas.height;

		// Determine if this player should control left or right paddle
		const isLeftPlayer = this.gameState.players[0]?.id === this.currentPlayer.id;

		if (isLeftPlayer) {
			// Control left paddle
			if (canvasY < this.gameState.players[0].paddle!.y + 50) {
				this.sendPlayerMove('up');
			} else {
				this.sendPlayerMove('down');
			}
		} else if (this.gameState.players[1]) {
			// Control right paddle
			if (canvasY < this.gameState.players[1].paddle!.y + 50) {
				this.sendPlayerMove('up');
			} else {
				this.sendPlayerMove('down');
			}
		}
	}

	private connectToServer() {
		this.updateConnectionStatus('connecting');

		// Prefer same-origin Socket.IO connection (proxy-aware for HTTP/HTTPS)
		// Allow override via ?server=<host or url>
		const urlParams = new URLSearchParams(window.location.search);
		const serverOverride = urlParams.get('server');

		if (serverOverride) {
			const serverUrl = serverOverride.startsWith('http')
				? serverOverride
				: `${window.location.protocol}//${serverOverride}:8000`;
			console.log('🌐 Connecting to override server:', serverUrl);
    this.socket = io(serverUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000
      });
		} else {
			console.log('🌐 Connecting to same-origin Socket.IO (proxy-aware)');
      this.socket = io({
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000
      });
		}

		this.socket.on('connect', () => {
			console.log('🔌 Connected to game server');
			console.log('🔍 Socket ID:', this.socket?.id);
			console.log('🔍 Socket connected:', this.socket?.connected);
			this.updateConnectionStatus('connected');
			this.reconnectAttempts = 0; // Reset reconnection counter
      // Cookie-based auth handled server-side
      });

		this.socket.on('disconnect', () => {
			console.log('🔌 Disconnected from game server');
			console.log('🔍 Disconnect reason:', arguments);
			this.updateConnectionStatus('disconnected');
			this.showMessage('Connection lost. Attempting to reconnect...', 'error');
			if (this.suggestionsInterval) {
				clearInterval(this.suggestionsInterval);
				this.suggestionsInterval = null;
			}
			if (this.invitationInterval) {
				clearInterval(this.invitationInterval);
				this.invitationInterval = null;
			}

			// Stop game loop if running
			if (this.gameLoopId) {
				cancelAnimationFrame(this.gameLoopId);
				this.gameLoopId = 0;
			}

			// Hide mobile controls
			const mobileControls = document.getElementById('mobileControls');
			if (mobileControls) {
				mobileControls.style.display = 'none';
			}

			this.showWaitingScreen();
		});

		this.socket.on('authenticated', (data) => {
			if (data.success) {
				console.log('✅ Authenticated successfully');
				console.log('👤 Current user:', data.user);
				console.log('🔍 Socket still connected:', this.socket?.connected);
				this.currentPlayer = data.user;
				this.enableGameButtons();
				this.refreshSuggestedGames();
				this.loadGameInvitations();
				this.processPendingJoinRequests();

				if (!this.suggestionsInterval) {
					this.suggestionsInterval = window.setInterval(() => this.refreshSuggestedGames(), 15000);
				}

				if (!this.invitationInterval) {
					this.invitationInterval = window.setInterval(() => this.loadGameInvitations(), 20000);
				}
			} else {
				console.error('❌ Authentication failed:', data.error);
				this.showMessage('Authentication failed. Please try creating a new session.', 'error');
				// Show auth prompt again instead of redirecting
				this.showAuthPrompt();
			}
		});

		this.socket.on('gameInvitation', () => {
			this.loadGameInvitations();
			this.showMessage('You have a new game invitation!', 'info');
		});

		this.socket.on('gameFound', (data) => {
			console.log('🎮 Game found:', data);
			this.roomId = data.roomId;
			console.log('🏠 Joined room:', this.roomId);
			// Don't immediately show searching screen - wait for playerJoined event
			// This prevents the race condition where we show searching when room is already full
		});

		this.socket.on('playerJoined', (data) => {
			if (data.gameSettings) {
				this.gameSettings = { ...this.gameSettings, ...data.gameSettings };
				this.canvas.width = this.gameSettings.width;
				this.canvas.height = this.gameSettings.height;
			}
			console.log('👤 Player joined:', data);
			console.log(`🔍 Room status: ${data.players.length} players, isRoomFull: ${data.isRoomFull}`);
			console.log(`🔍 Players data:`, JSON.stringify(data.players));
			console.log(`🔍 Tournament match:`, this.tournamentMatch);
			this.updatePlayersInfo(data.players);

			if (data.isRoomFull) {
				console.log('🎉 Room is full! Showing room screen...');
				this.showRoomScreen(data.players);

				// Show appropriate message for tournament vs regular match
				if (this.tournamentMatch) {
					this.showMessage(`🏆 Tournament match ready! Starting game automatically...`);

					// Auto-ready for tournament matches - no manual ready click required
					console.log('🏆 Auto-readying player for tournament match');
					setTimeout(() => {
						if (this.socket) {
							console.log('✅ Emitting playerReady for tournament auto-start');
							this.socket.emit('playerReady');

							// Update button to show waiting state
							const readyBtn = document.getElementById('readyBtn') as HTMLButtonElement;
							if (readyBtn) {
								readyBtn.textContent = 'Starting tournament match...';
								readyBtn.disabled = true;
								readyBtn.classList.add('opacity-50');
							}
						}
					}, 500); // Small delay to ensure room is fully set up
				} else {
					this.showMessage(`Room full! ${data.players.length} players ready. Click "Ready to Play" to start!`);

					// Ensure ready button is visible and enabled for non-tournament matches
					const readyBtn = document.getElementById('readyBtn') as HTMLButtonElement;
					if (readyBtn) {
						console.log('✅ Ready button found and visible');
						readyBtn.style.display = 'block';
						readyBtn.disabled = false;
						readyBtn.classList.remove('opacity-50');
					} else {
						console.error('❌ Ready button NOT found in DOM!');
					}
				}
			} else {
				console.log('⏳ Waiting for more players...');
				this.showSearchingScreen(); // Show searching screen only when actually waiting

				// Show appropriate message for tournament vs regular match
				if (this.tournamentMatch) {
					this.showMessage(`Waiting for opponent to join tournament match... (${data.players.length}/2 players)`);
				} else {
					this.showMessage(`Waiting for opponent... (${data.players.length}/2 players)`);
				}
			}
		});

		this.socket.on('playerReady', (data) => {
			console.log('✅ Player ready:', data);
			if (data.allReady) {
				this.showMessage('All players ready! Game starting...');
			}
		});

		this.socket.on('gameStart', (data) => {
			console.log('🚀 Game starting:', data);
			this.gameSettings = { ...this.gameSettings, ...data.gameSettings };
			this.gameState = {
				ball: data.ball,
				players: data.players
			};
			this.clearRoomCodeDisplay();

			// Update canvas size based on server settings
			this.canvas.width = this.gameSettings.width;
			this.canvas.height = this.gameSettings.height;

			console.log(`🎮 Game state initialized:`, {
				ball: this.gameState.ball,
				players: this.gameState.players.length,
				canvasSize: `${this.canvas.width}x${this.canvas.height}`
			});

			this.startGame();
		});

		this.socket.on('gameUpdate', (data) => {
			if (this.gameState && data.ball && data.players) {
				// Performance: Store server state and timestamp for interpolation
				const now = performance.now();
				this.lastServerUpdate = now;

				// Store previous ball state for interpolation
				if (this.gameState?.ball && data.ball.vx !== undefined && data.ball.vy !== undefined) {
					this.lastBallState = {
						x: this.gameState.ball.x,
						y: this.gameState.ball.y,
						vx: data.ball.vx,
						vy: data.ball.vy,
						timestamp: now
					};
				}

				this.gameState.ball = data.ball;
				this.gameState.players = data.players;

				// Initialize interpolated ball position
				this.interpolatedBall = { x: data.ball.x, y: data.ball.y };
			}
		});

		this.socket.on('spectatorJoined', (data) => {
			this.showMessage(`${data.username} is now spectating`);
		});

		this.socket.on('spectatorLeft', (data) => {
			this.showMessage(`${data.username} stopped spectating`);
		});

		this.socket.on('playerMove', (data) => {
			if (this.gameState) {
				const player = this.gameState.players.find(p => p.id === data.playerId);
				if (player && player.paddle) {
					player.paddle = data.paddle;
				}
			}
		});

		this.socket.on('score', (data) => {
			console.log('⚽ Score:', data);
			this.updateScore(data.leftScore, data.rightScore);
			// Don't show popup message - score is visible on scoreboard
		});

		this.socket.on('countdown', (count) => {
			console.log('⏱️  Countdown received:', count);
			this.countdownActive = true;
			this.countdownValue = count;
			if (count === 0) {
				this.countdownActive = false;
			}
		});

		this.socket.on('gameEnd', (data) => {
			console.log('🏆 Game ended:', data);
			this.endGame(data.winner, data.finalScore);
		});

		this.socket.on('playerLeft', (data) => {
			console.log('👋 Player left:', data);
			this.showMessage(data.message);
			if (data.remaining === 0) {
				this.showWaitingScreen();
				this.clearRoomCodeDisplay();
			}
		});

		this.socket.on('error', (error) => {
			console.error('❌ Socket error:', error);
			this.showMessage('Connection error: ' + error, 'error');
		});

		this.socket.on('roomList', (rooms) => {
			console.log('📋 Room list received:', rooms);
			this.renderGamesList(rooms);
		});

		this.socket.on('privateRoomCreated', (data) => {
			console.log('🔒 Private room created:', data);
			this.roomId = data.roomId;
			this.displayRoomCode(data.roomCode);
			this.showMessage(`Private room created! Code: ${data.roomCode}`, 'info');
			this.showWaitingScreen();
		});

		this.socket.on('roomJoined', (data) => {
			console.log('🚪 Joined room:', data);
			this.roomId = data.roomId;
			if (data.roomCode) {
				this.displayRoomCode(data.roomCode);
			}
		});

		this.socket.on('roomNotFound', (data) => {
			console.log('❌ Room not found:', data);
			this.showMessage(`Room ${data.code} not found. Please check the code and try again.`, 'error');
		});

		this.socket.on('spectatorJoined', (data) => {
			if (data.roomId) {
				// Spectator successfully joined a game
				this.gameState = {
					ball: data.ball,
					players: data.players
				};
				this.startSpectatorMode();
			} else {
				// Show spectator count update
				this.showMessage(`${data.username} is now spectating (${data.spectatorCount} total)`);
			}
		});
	}

  // Cookie-based auth: no client token emission required

	private attemptReconnection() {
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			this.reconnectAttempts++;
			console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
			this.showMessage(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
			this.connectToServer();
		} else {
			this.showMessage('Connection lost. Please refresh the page.', 'error');
		}
	}

	private findGame() {
		console.log('🎯 findGame() called');
		console.log('🔍 Socket exists:', !!this.socket);
		console.log('🔍 Socket connected:', this.socket?.connected);

		if (!this.socket) {
			console.error('❌ No socket connection available!');
			this.showMessage('Connection error. Please refresh the page.', 'error');
			return;
		}

		if (!this.socket.connected) {
			console.error('❌ Socket is not connected!');
			this.showMessage('Not connected to server. Reconnecting...', 'error');
			this.connectToServer();
			return;
		}

		console.log('✅ Emitting findGame event to server');
		this.socket.emit('findGame');
		this.showSearchingScreen();
	}

	private cancelSearch() {
		if (this.socket) {
			this.socket.emit('leaveGame');
		}
		this.clearRoomCodeDisplay();
		this.showWaitingScreen();
	}

	private requestRoomList() {
		if (this.socket) {
			this.socket.emit('listRooms');
		}
	}

	private setPlayerReady() {
		console.log('🎮 Player clicking ready button...');
		if (this.socket) {
			console.log('✅ Emitting playerReady event to server');
			this.socket.emit('playerReady');
			const readyBtn = document.getElementById('readyBtn') as HTMLButtonElement;
			if (readyBtn) {
				readyBtn.textContent = 'Waiting for opponent...';
				readyBtn.disabled = true;
				readyBtn.classList.add('opacity-50');
				console.log('🔄 Ready button updated to waiting state');
			}
		} else {
			console.error('❌ Socket not connected!');
		}
	}

	private handleKeyPress(key: string) {
		if (!this.gameState) return;

		const lowerKey = key.toLowerCase();
		if (lowerKey === 'w' || key === 'ArrowUp') {
			this.sendPlayerMove('up');
		} else if (lowerKey === 's' || key === 'ArrowDown') {
			this.sendPlayerMove('down');
		} else if (key === 'Escape') {
			this.pauseGame();
		}
	}

	private sendPlayerMove(direction: 'up' | 'down' | 'stop') {
		if (this.socket) {
			this.socket.emit('playerMove', { direction });
		}
	}

	private pauseGame() {
		// Pause functionality handled by backend
		console.log('Pause requested');
	}

	private startGame() {
		console.log('🎮 Starting game display...');

		// Stop any existing game loop
		if (this.gameLoopId) {
			cancelAnimationFrame(this.gameLoopId);
			this.gameLoopId = 0;
		}

		// Hide waiting screens and show game
		this.hideAllScreens();

		// Show game container and canvas
		const gameContainer = document.getElementById('gameContainer');
		if (gameContainer) {
			gameContainer.style.display = 'block';
		}

		this.gameCanvas.style.display = 'block';

		// Update game status
		const gameStatus = document.getElementById('gameStatus');
		if (gameStatus) {
			gameStatus.textContent = 'Game in progress - Good luck!';
		}

		// Show mobile controls if on mobile device
		if (this.touchControls) {
			const mobileControls = document.getElementById('mobileControls');
			if (mobileControls) {
				mobileControls.style.display = 'flex';
			}
		}

		// Initial render to show the game state immediately
		this.render();

		// Start render loop
		this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
		console.log('✅ Game render loop started');
	}

	private gameLoop() {
		try {
			this.render();
			// Only continue loop if game is still active
			if (this.gameState && this.socket && this.socket.connected) {
				this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
			} else {
				console.log('🛑 Game loop stopped - game state or connection lost');
				this.gameLoopId = 0;
			}
		} catch (error) {
			console.error('❌ Error in game loop:', error);
			this.gameLoopId = 0;
		}
	}

	private render() {
		if (!this.gameState) return;

		// Optimized: Clear canvas with single operation
		this.ctx.fillStyle = '#000';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		// Disable shadow effects for better performance
		this.ctx.shadowBlur = 0;

		// Draw center line (simplified)
		this.ctx.strokeStyle = '#00ffff';
		this.ctx.lineWidth = 2;
		this.ctx.setLineDash([10, 10]);
		this.ctx.beginPath();
		this.ctx.moveTo(this.canvas.width / 2, 0);
		this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
		this.ctx.stroke();
		this.ctx.setLineDash([]);

		// Draw paddles (no glow effects for performance)
		if (this.gameState.players[0]?.paddle) {
			this.ctx.fillStyle = '#00ffff';
			this.ctx.fillRect(10, this.gameState.players[0].paddle.y, this.gameSettings.paddleWidth, this.gameSettings.paddleHeight);
		}

		if (this.gameState.players[1]?.paddle) {
			this.ctx.fillStyle = '#ff00ff';
			this.ctx.fillRect(this.canvas.width - 16, this.gameState.players[1].paddle.y, this.gameSettings.paddleWidth, this.gameSettings.paddleHeight); // Adjusted position for thinner paddle
		}

		// Performance: Use interpolated ball position for smoother movement
		const ballPosition = this.getInterpolatedBallPosition();

		// Draw ball (simple, no glow for performance)
		this.ctx.fillStyle = '#ffffff';
		this.ctx.beginPath();
		this.ctx.arc(ballPosition.x, ballPosition.y, this.gameSettings.ballSize / 2, 0, Math.PI * 2);
		this.ctx.fill();

		// Draw countdown if active
		if (this.countdownActive && this.countdownValue > 0) {
			const messages: { [key: number]: string } = {
				3: 'READY',
				2: 'SET',
				1: 'GO!'
			};
			const colors: { [key: number]: string } = {
				3: '#22d3ee',
				2: '#fbbf24',
				1: '#10b981'
			};
			const message = messages[this.countdownValue] || this.countdownValue.toString();
			const color = colors[this.countdownValue] || '#22d3ee';

			this.ctx.font = 'bold 80px Arial';
			this.ctx.fillStyle = color;
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'middle';
			this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
		}

		// Remove debug info to reduce rendering overhead
		// Production version should have minimal text rendering
	}

	private getInterpolatedBallPosition(): { x: number; y: number } {
		if (!this.gameState || !this.lastBallState || !this.interpolatedBall) {
			return this.gameState ? this.gameState.ball : { x: 0, y: 0 };
		}

		// Performance: Simple client-side prediction between server updates
		const now = performance.now();
		const timeSinceUpdate = now - this.lastServerUpdate;

		// Limit interpolation to prevent issues if server is delayed
		if (timeSinceUpdate > 100) { // 100ms max
			return { x: this.gameState.ball.x, y: this.gameState.ball.y };
		}

		// Simple linear interpolation based on ball velocity
		const deltaTime = timeSinceUpdate / 1000; // Convert to seconds
		const predictedX = this.gameState.ball.x + (this.lastBallState.vx * deltaTime * 60); // Scale for 60fps
		const predictedY = this.gameState.ball.y + (this.lastBallState.vy * deltaTime * 60);

		// Clamp to canvas bounds to prevent visual glitches
		const clampedX = Math.max(0, Math.min(this.canvas.width, predictedX));
		const clampedY = Math.max(0, Math.min(this.canvas.height, predictedY));

		return { x: clampedX, y: clampedY };
	}

	private updateScore(leftScore: number, rightScore: number) {
		// Update scoreboard (uses score1 and score2 IDs)
		const score1El = document.getElementById('score1');
		const score2El = document.getElementById('score2');

		if (score1El) score1El.textContent = leftScore.toString();
		if (score2El) score2El.textContent = rightScore.toString();

		// Update progress bar if available
		const scoreProgress = document.getElementById('scoreProgress');
		if (scoreProgress) {
			const total = leftScore + rightScore;
			const leftPercentage = total > 0 ? (leftScore / total) * 100 : 50;
			scoreProgress.style.width = `${leftPercentage}%`;
		}
	}

	private updatePlayersInfo(players: Player[]) {
		const playersInfo = document.getElementById('playersInfo');
		if (!playersInfo) return;

		playersInfo.innerHTML = players.map(player => `
      <div class="flex justify-between items-center p-2 bg-gray-800/50 rounded">
        <span class="text-cyan-400">${player.username}</span>
        <span class="text-xs ${player.ready ? 'text-green-400' : 'text-yellow-400'}">
          ${player.ready ? 'Ready' : 'Not Ready'}
        </span>
      </div>
    `).join('');

		// Update HUD player names
		if (players[0]) {
			const player1Name = document.getElementById('player1Name');
			if (player1Name) player1Name.textContent = players[0].username;
		}
		if (players[1]) {
			const player2Name = document.getElementById('player2Name');
			if (player2Name) player2Name.textContent = players[1].username;
		}
	}

	private endGame(winner: string, finalScore: any) {
		this.hideAllScreens();

		// Check if this is a tournament match
		const urlParams = new URLSearchParams(window.location.search);
		const isTournament = urlParams.get('tournament') === 'true';

		if (isTournament) {
			// Handle tournament match completion
			this.handleTournamentMatchEnd(winner, finalScore);
		}

		const gameResult = document.getElementById('gameResult');
		const finalScoreEl = document.getElementById('finalScore');
		const winnerIcon = document.getElementById('winnerIcon');

		if (gameResult) {
			gameResult.textContent = winner === this.currentPlayer?.username ? 'You Won!' : `${winner} Won!`;
			gameResult.className = winner === this.currentPlayer?.username ? 'text-2xl font-bold mb-2 text-green-400' : 'text-2xl font-bold mb-2 text-red-400';
		}

		if (finalScoreEl) {
			finalScoreEl.textContent = Object.entries(finalScore).map(([name, score]) => `${name}: ${score}`).join(' - ');
		}

		if (winnerIcon) {
			winnerIcon.className = `w-20 h-20 mx-auto mb-4 border-2 rounded-full flex items-center justify-center ${winner === this.currentPlayer?.username ? 'border-green-400' : 'border-red-400'
				}`;
		}

		// Update Play Again button text for tournaments
		if (isTournament) {
			const playAgainBtn = document.getElementById('playAgainBtn');
			if (playAgainBtn) {
				playAgainBtn.textContent = 'Return to Tournament';
			}
		}

		this.gameOverModal.style.display = 'flex';
	}

	private handleTournamentMatchEnd(winner: string, finalScore: any) {
		console.log('🏆 Tournament match ended:', { winner, finalScore });

		// Store match result data for tournament system
		const matchResult = {
			winner: winner,
			finalScore: finalScore,
			timestamp: Date.now()
		};

		localStorage.setItem('tournamentMatchResult', JSON.stringify(matchResult));
	}

	private playAgain() {
		this.gameOverModal.style.display = 'none';

		// Check if this is a tournament match
		const urlParams = new URLSearchParams(window.location.search);
		const isTournament = urlParams.get('tournament') === 'true';

		if (isTournament) {
			// Return to tournament page
			navigateSpa('/tournament');
		} else {
			// Find another regular game
			this.findGame();
		}
	}

	private showWaitingScreen() {
		this.hideAllScreens();
		this.waitingScreen.style.display = 'block';
		this.showGameShell();
	}

	private showAuthPrompt() {
		this.hideAllScreens();
		this.waitingScreen.style.display = 'block';
		this.authPrompt.style.display = 'block';
		this.showGameShell();
	}

	private showSearchingScreen() {
		this.hideAllScreens();
		this.waitingScreen.style.display = 'block';
		this.searchingScreen.style.display = 'block';
		this.showGameShell();

		// Update game status
		const gameStatus = document.getElementById('gameStatus');
		if (gameStatus) {
			gameStatus.textContent = 'Searching for opponent...';
		}
	}

	private showRoomScreen(players: Player[]) {
		console.log('🎬 Showing room screen for players:', players);
		this.hideAllScreens();
		this.waitingScreen.style.display = 'block';
		this.roomScreen.style.display = 'block';
		this.showGameShell();
		this.updatePlayersInfo(players);

		// Update game status
		const gameStatus = document.getElementById('gameStatus');
		if (gameStatus) {
			gameStatus.textContent = 'Opponent found! Click "Ready to Play" when ready';
		}

		// Reset ready button
		const readyBtn = document.getElementById('readyBtn') as HTMLButtonElement;
		if (readyBtn) {
			readyBtn.textContent = 'Ready to Play';
			readyBtn.disabled = false;
			readyBtn.classList.remove('opacity-50');
			console.log('✅ Ready button reset and enabled');
		} else {
			console.error('❌ Ready button not found!');
		}
	}

	private hideAllScreens() {
		this.waitingScreen.style.display = 'none';
		this.authPrompt.style.display = 'none';
		this.searchingScreen.style.display = 'none';
		this.roomScreen.style.display = 'none';
		this.gameCanvas.style.display = 'none';

		// Hide game container
		const gameContainer = document.getElementById('gameContainer');
		if (gameContainer) {
			gameContainer.style.display = 'none';
		}

		// Hide mobile controls when hiding screens
		const mobileControls = document.getElementById('mobileControls');
		if (mobileControls) {
			mobileControls.style.display = 'none';
		}
	}

	private showGameShell() {
		const gameContainer = document.getElementById('gameContainer');
		if (gameContainer) {
			gameContainer.style.display = 'block';
		}
		this.gameCanvas.style.display = 'block';
	}

	private updateConnectionStatus(status: 'connected' | 'connecting' | 'disconnected') {
		console.log('🔄 Updating connection status to:', status);

		const statusText = document.getElementById('connectionStatus');
		const statusIndicator = document.getElementById('connectionIndicator');
		const statusContainer = document.getElementById('connectionStatusContainer');

		if (statusText) {
			const textClass =
				status === 'connected'
					? 'text-green-300'
					: status === 'connecting'
						? 'text-yellow-300'
						: 'text-red-300';
			statusText.textContent =
				status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected';
			statusText.className = `text-sm font-medium ${textClass}`;
			console.log('✅ Status text updated to:', statusText.textContent);
		} else {
			console.warn('⚠️ connectionStatus element not found');
		}

		if (statusIndicator) {
			const baseIndicator = 'h-2 w-2 rounded-full';
			const indicatorClass =
				status === 'connected'
					? `${baseIndicator} bg-green-400`
					: status === 'connecting'
						? `${baseIndicator} bg-yellow-400 animate-pulse`
						: `${baseIndicator} bg-red-400`;
			statusIndicator.className = indicatorClass;
			console.log('✅ Status indicator updated with class:', statusIndicator.className);
		} else {
			console.warn('⚠️ connectionIndicator element not found');
		}

		if (statusContainer) {
			statusContainer.classList.remove('border-gray-700', 'border-green-500/60', 'border-yellow-400/60', 'border-red-500/60');
			const borderClass =
				status === 'connected'
					? 'border-green-500/60'
					: status === 'connecting'
						? 'border-yellow-400/60'
						: 'border-red-500/60';
			statusContainer.classList.add(borderClass);
		}
	}

	private startSpectatorMode() {
		console.log('👁️ Starting spectator mode');
		this.hideAllScreens();
		
		// Show game container
		const gameContainer = document.getElementById('gameContainer');
		if (gameContainer) {
			gameContainer.style.display = 'block';
		}
		this.gameCanvas.style.display = 'block';

		// Add spectator indicator
		let spectatorIndicator = document.getElementById('spectatorIndicator');
		if (!spectatorIndicator) {
			spectatorIndicator = document.createElement('div');
			spectatorIndicator.id = 'spectatorIndicator';
			spectatorIndicator.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-purple-600/90 text-white px-4 py-2 rounded-lg text-sm font-semibold z-50';
			spectatorIndicator.textContent = '👁️ Spectating';
			document.body.appendChild(spectatorIndicator);
		}

		// Start spectator render loop
		this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
	}

	private showMessage(message: string, type: 'info' | 'error' = 'info') {
		// Create temporary message element
		const messageEl = document.createElement('div');
		messageEl.className = `fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg ${type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
			}`;
		messageEl.textContent = message;

		document.body.appendChild(messageEl);

		setTimeout(() => {
			messageEl.remove();
		}, 3000);
	}

	private disableGameButtons() {
		// Disable lobby controls until authenticated
		const findGameBtn = document.getElementById('findGameBtn') as HTMLButtonElement;
		const refreshRoomsBtn = document.getElementById('refreshRoomsBtn') as HTMLButtonElement;
		const joinByCodeBtn = document.getElementById('joinByCodeBtn') as HTMLButtonElement;

		if (findGameBtn) {
			findGameBtn.disabled = true;
			findGameBtn.classList.add('opacity-50', 'cursor-not-allowed');
		}

		if (refreshRoomsBtn) {
			refreshRoomsBtn.disabled = true;
			refreshRoomsBtn.classList.add('opacity-50', 'cursor-not-allowed');
		}

		if (joinByCodeBtn) {
			joinByCodeBtn.disabled = true;
			joinByCodeBtn.classList.add('opacity-50', 'cursor-not-allowed');
		}
	}

	private enableGameButtons() {
		// Enable lobby controls after authentication
		const findGameBtn = document.getElementById('findGameBtn') as HTMLButtonElement;
		const refreshRoomsBtn = document.getElementById('refreshRoomsBtn') as HTMLButtonElement;
		const joinByCodeBtn = document.getElementById('joinByCodeBtn') as HTMLButtonElement;

		if (findGameBtn) {
			findGameBtn.disabled = false;
			findGameBtn.classList.remove('opacity-50', 'cursor-not-allowed');
		}

		if (refreshRoomsBtn) {
			refreshRoomsBtn.disabled = false;
			refreshRoomsBtn.classList.remove('opacity-50', 'cursor-not-allowed');
		}

		if (joinByCodeBtn) {
			joinByCodeBtn.disabled = false;
			joinByCodeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
		}
	}

	private createPrivateRoom() {
		if (!this.socket || !this.currentPlayer) {
			this.showMessage('Please wait, connecting to server...', 'error');
			return;
		}

		// Request private room creation from server
		this.socket.emit('createPrivateRoom');
		this.showMessage('Creating private room...', 'info');
	}

	private joinRoomByCode(code: string, options: { auto?: boolean } = {}) {
		const trimmed = code.trim().toUpperCase();
		if (!trimmed) return;

		if (!this.socket || !this.socket.connected || !this.currentPlayer) {
			this.pendingJoinCode = trimmed;
			if (!options.auto) {
				this.showMessage('Connecting to server, please wait...', 'info');
			}
			return;
		}

		console.log(`🔑 Attempting to join room with code: ${trimmed}`);
		this.socket.emit('joinRoomByCode', { code: trimmed });
		if (!options.auto) {
			this.showMessage(`Joining room ${trimmed}...`, 'info');
		}
	}

	private processPendingJoinRequests() {
		if (this.pendingJoinCode) {
			const code = this.pendingJoinCode;
			this.pendingJoinCode = null;
			this.joinRoomByCode(code, { auto: true });
		}
	}

	private refreshSuggestedGames() {
		this.requestRoomList();
	}

	private async loadGameInvitations() {
		const list = document.getElementById('game-invite-list');
		if (!list) return;
		try {
			const response = await authFetch('/api/friends/invitations');
			if (!response.ok) throw new Error(`Status ${response.status}`);
			const data = await response.json();
			const invitations: GameInvitation[] = data.invitations || [];
			this.renderGameInvitations(invitations);
		} catch (error) {
			console.log('Failed to load game invitations:', error);
			list.innerHTML = `
				<div class="text-sm text-gray-500">Unable to load invitations.</div>
			`;
		}
	}

	private renderGameInvitations(invitations: GameInvitation[]) {
		const list = document.getElementById('game-invite-list');
		const emptyState = document.getElementById('game-invite-empty');
		if (!list || !emptyState) return;

		if (invitations.length === 0) {
			emptyState.classList.remove('hidden');
			list.innerHTML = '';
			return;
		}

		emptyState.classList.add('hidden');
		list.innerHTML = invitations.map(invite => {
			const display = invite.sender_display_name || invite.sender_username;
			return `
				<div class="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-lg p-4">
					<div class="flex-1">
						<div class="text-sm text-gray-400">Game invite from</div>
						<div class="text-lg font-semibold text-white">${display}</div>
						<div class="text-xs text-gray-500">Code: <span class="font-mono">${invite.room_code}</span></div>
					</div>
					<div class="flex gap-2">
						<button class="px-3 py-2 bg-cyan-600/80 hover:bg-cyan-600 border border-cyan-400 rounded text-white text-sm font-semibold"
							data-accept-invite="${invite.id}" data-room-code="${invite.room_code}">
							Join
						</button>
						<button class="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-200 text-sm"
							data-decline-invite="${invite.id}">
							Dismiss
						</button>
					</div>
				</div>
			`;
		}).join('');
	}

	private clearRoomCodeDisplay() {
		const codeText = document.getElementById('roomCodeText');
		const activeCard = document.getElementById('active-room-card');
		const waitingCode = document.getElementById('roomCodeDisplay');
		if (codeText) codeText.textContent = '------';
		if (activeCard) activeCard.classList.add('hidden');
		if (waitingCode) waitingCode.textContent = '';
	}

	private async acceptGameInvitation(invitationId: number, roomCode: string) {
		try {
			await authFetch(`/friends/invitation/${invitationId}/accept`, { method: 'POST' });
			this.loadGameInvitations();
			this.joinRoomByCode(roomCode, { auto: true });
		} catch (error) {
			console.error('Failed to accept invitation:', error);
			this.showMessage('Failed to join invitation.', 'error');
		}
	}

	private async declineGameInvitation(invitationId: number) {
		try {
			await authFetch(`/friends/invitation/${invitationId}/reject`, { method: 'POST' });
			this.loadGameInvitations();
		} catch (error) {
			console.error('Failed to decline invitation:', error);
			this.showMessage('Failed to dismiss invitation.', 'error');
		}
	}

	private displayRoomCode(roomCode: string) {
		const roomCodeText = document.getElementById('roomCodeText');
		const roomCodeDisplay = document.getElementById('roomCodeDisplay');
		const activeCard = document.getElementById('active-room-card');

		if (roomCodeText) {
			roomCodeText.textContent = roomCode;
		}
		if (roomCodeDisplay) {
			roomCodeDisplay.style.display = 'block';
		}
		if (activeCard) {
			activeCard.classList.remove('hidden');
		}
	}

	private renderGamesList(rooms: any[]) {
		const container = document.getElementById('suggested-games-list');
		const emptyState = document.getElementById('suggested-games-empty');
		if (!container || !emptyState) return;

		const joinableRooms = rooms.filter(room => room.canJoin && !room.isPrivate);

		if (joinableRooms.length === 0) {
			emptyState.classList.remove('hidden');
			container.innerHTML = '';
			return;
		}

		emptyState.classList.add('hidden');
		container.innerHTML = joinableRooms.map(room => {
			const host = room.hostUsername || 'Player';
			return `
				<div class="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-lg p-4">
					<div class="flex-1">
						<div class="text-sm text-gray-400">Hosted by</div>
						<div class="text-lg font-semibold text-white">${host}</div>
						<div class="text-xs text-gray-500">Players ${room.players.length}/2 • Status: ${room.gameState}</div>
					</div>
					<button class="px-3 py-2 bg-yellow-400/20 hover:bg-yellow-400/30 border border-yellow-400 rounded text-yellow-200 text-sm font-semibold"
						data-join-room="${room.id}">
						Join
					</button>
				</div>
			`;
		}).join('');

		container.querySelectorAll('[data-join-room]').forEach(btn => {
			btn.addEventListener('click', (event) => {
				const roomId = (event.currentTarget as HTMLElement).getAttribute('data-join-room');
				if (roomId && this.socket) {
					this.socket.emit('joinRoom', { roomId });
					this.showMessage('Joining game...', 'info');
				}
			});
		});
	}
}

// Initialize when DOM is ready; in SPA, DOMContentLoaded may have already fired
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		new OnlineGameClient();
	});
} else {
	new OnlineGameClient();
}

