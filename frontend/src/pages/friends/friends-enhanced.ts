// Enhanced Friends Page with Real-time Online Status
import { io, Socket } from 'socket.io-client';
import { showPopupNotification } from '../../notification';
import { validateAuth, getCachedUser } from '../../shared/auth';
import { authFetch } from '../../shared/auth';
import { renderBackground, renderNavbar, renderBackButton } from '../../shared/ui/layout';

let socket: Socket | null = null;
let friendsData: Map<number, any> = new Map();

export async function render(container: HTMLElement) {
  const authed = getCachedUser() !== null || await validateAuth() !== null;
  if (!authed) { (window as any).navigate('/login'); return; }

	container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden text-white">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col">
        ${renderNavbar({
          title: 'Friends',
          subtitle: 'Connect and play with friends in real time.',
          rightContent: renderBackButton({ href: '/dashboard', label: 'Back to Dashboard' }),
        })}

        <main class="flex-1 p-4 md:p-6">
          <div class="max-w-6xl mx-auto space-y-6">

        <!-- Stats Bar -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div class="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-400/30 hover:border-cyan-400/50 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/20">
            <div class="text-gray-400 text-xs md:text-sm mb-1">Total Friends</div>
            <div id="total-friends" class="text-2xl md:text-3xl font-bold text-cyan-400">0</div>
          </div>
          <div class="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-400/30 hover:border-green-400/50 transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20">
            <div class="text-gray-400 text-xs md:text-sm mb-1">Online Now</div>
            <div id="online-friends" class="text-2xl md:text-3xl font-bold text-green-400 flex items-center gap-2">
              <span class="relative flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              0
            </div>
          </div>
          <div class="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-400/30 hover:border-yellow-400/50 transition-all duration-200 hover:shadow-lg hover:shadow-yellow-500/20">
            <div class="text-gray-400 text-xs md:text-sm mb-1">Pending</div>
            <div id="pending-requests" class="text-2xl md:text-3xl font-bold text-yellow-400">0</div>
          </div>
          <div class="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-400/30 hover:border-purple-400/50 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/20">
            <div class="text-gray-400 text-xs md:text-sm mb-1">Sent</div>
            <div id="sent-requests" class="text-2xl md:text-3xl font-bold text-purple-400">0</div>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="grid md:grid-cols-3 gap-6">

          <!-- Friends List -->
          <div class="md:col-span-2 space-y-4">

            <!-- Search Bar -->
            <div class="p-5 rounded-xl bg-gradient-to-br from-gray-900/60 to-gray-800/40 border border-cyan-400/30 backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-200">
              <div class="flex items-center gap-2 mb-3">
                <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                <h3 class="text-lg font-semibold text-cyan-300">Find Friends</h3>
              </div>
              <div class="flex gap-2">
                <input
                  id="search-input"
                  type="text"
                  placeholder="Search by username..."
                  class="flex-1 px-4 py-2.5 bg-gray-800/60 border border-gray-700 rounded-lg focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 text-white placeholder-gray-400 transition-all duration-200"
                />
                <button
                  id="search-btn"
                  class="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-cyan-500/50"
                >
                  Search
                </button>
              </div>
              <div id="search-results" class="mt-4"></div>
            </div>

            <!-- Friends List -->
            <div class="p-5 rounded-xl bg-gradient-to-br from-gray-900/60 to-gray-800/40 border border-gray-700/50 backdrop-blur-sm">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                  <h3 class="text-lg font-semibold text-cyan-300">Your Friends</h3>
                </div>
                <div class="flex gap-2">
                  <button id="filter-all" class="px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-all duration-200 shadow-md">All</button>
                  <button id="filter-online" class="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-all duration-200">Online</button>
                </div>
              </div>
              <div id="friends-list" class="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar"></div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="space-y-4">

            <!-- Received Requests -->
            <div class="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-400/30 hover:border-yellow-400/50 transition-all duration-200">
              <div class="flex items-center gap-2 mb-3">
                <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"></path>
                </svg>
                <h3 class="text-lg font-semibold text-yellow-300">Requests</h3>
              </div>
              <div id="requests-received" class="space-y-2"></div>
            </div>

            <!-- Sent Requests -->
            <div class="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-400/30 hover:border-purple-400/50 transition-all duration-200">
              <div class="flex items-center gap-2 mb-3">
                <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
                <h3 class="text-lg font-semibold text-purple-300">Sent</h3>
              </div>
              <div id="requests-sent" class="space-y-2"></div>
            </div>

            <!-- Game Invitations -->
            <div class="p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-pink-600/5 border border-pink-400/30 hover:border-pink-400/50 transition-all duration-200">
              <div class="flex items-center gap-2 mb-3">
                <svg class="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"></path>
                </svg>
                <h3 class="text-lg font-semibold text-pink-300">Game Invites</h3>
              </div>
              <div id="game-invitations" class="space-y-2"></div>
            </div>
          </div>
        </div>

        <!-- Notification Area -->
        <div id="notification-area" class="fixed bottom-4 right-4 space-y-2 z-50"></div>
      </div>
        </main>
      </div>
    </div>
  `;

	// Initialize WebSocket
	initializeSocket();

	// Load initial data
	await loadAllData();

	// Setup event listeners
	setupEventListeners();
}

function initializeSocket() {
	// Disconnect existing socket if any
	if (socket && socket.connected) {
		console.log('🔌 Disconnecting existing socket');
		socket.disconnect();
	}

	// Use relative URL to connect through nginx proxy (same origin)
	// This avoids mixed content issues with HTTPS
	const socketUrl = window.location.protocol === 'https:'
		? `wss://${window.location.host}`
		: `ws://${window.location.host}`;

	console.log('🔌 Connecting to WebSocket:', socketUrl);

	socket = io(socketUrl, {
		path: '/socket.io',
		transports: ['websocket', 'polling'],
		secure: window.location.protocol === 'https:',
		withCredentials: true,
		reconnection: true,
		reconnectionDelay: 1000,
		reconnectionAttempts: 5
	});

	socket.on('connect', () => { console.log('✅ Socket connected'); });

	socket.on('authenticated', (data: any) => {
		if (data.success) {
			console.log('✅ Socket authenticated:', data.user);
		} else {
			console.error('❌ Socket authentication failed:', data.error);
		}
	});

	socket.on('connect_error', (error: Error) => {
		console.error('❌ Socket connection error:', error);
	});

	socket.on('error', (error: Error) => {
		console.error('❌ Socket error:', error);
	});

	// Listen for friend status changes
	socket.on('friendStatusChanged', (data: any) => {
		console.log('👥 Friend status changed:', data);
		updateFriendOnlineStatus(data.user_id, data.is_online);
		// Only show notification when friend comes online, not when they go offline
		if (data.is_online) {
			showNotification(`${data.display_name || data.username} is now online`, 'info');
		}
	});

	// Listen for friend request notifications
	socket.on('friendRequestReceived', (data: any) => {
		console.log('📨 Friend request received:', data);
		showPopupNotification(`${data.sender_username} sent you a friend request!`, 'success', {
			duration: 12000,
			actions: [
				{
					label: 'Accept',
					variant: 'primary',
					closeOnClick: false,
					onClick: async (close) => {
						const success = await acceptFriendRequestById(Number(data.request_id));
						if (success) close();
					}
				},
				{
					label: 'Reject',
					variant: 'secondary',
					closeOnClick: false,
					onClick: async (close) => {
						const success = await rejectFriendRequestById(Number(data.request_id));
						if (success) close();
					}
				}
			]
		});
		loadRequestsReceived();
		updateStats();
	});

	socket.on('friendRequestAccepted', (data: any) => {
		console.log('✅ Friend request accepted:', data);
		showNotification(`${data.username} accepted your friend request!`, 'success');
		loadAllData();
	});

	socket.on('friendRemoved', (data: any) => {
		console.log('👋 Friend removed:', data);
		showNotification(`${data.username} removed you as a friend`, 'warning');
		loadAllData();
	});

	socket.on('gameInvitation', (data: any) => {
		console.log('🎮 Game invitation received:', data);
		showPopupNotification(`${data.sender_username} invited you to a game!`, 'success', {
			duration: 15000,
			actions: [
				{
					label: 'Join',
					variant: 'primary',
					closeOnClick: false,
					onClick: async (close) => {
						const success = await acceptGameInvitationById(Number(data.invitation_id));
						if (success) close();
					}
				},
				{
					label: 'Decline',
					variant: 'secondary',
					closeOnClick: false,
					onClick: async (close) => {
						const success = await rejectGameInvitationById(Number(data.invitation_id));
						if (success) close();
					}
				}
			]
		});
		loadGameInvitations();
	});

	socket.on('disconnect', (reason: string) => {
		console.log('❌ Socket disconnected:', reason);
	});

	socket.on('reconnect', (attemptNumber: number) => {
		console.log('✅ Socket reconnected after', attemptNumber, 'attempts');
		// Reload data after reconnection
		loadAllData();
	});
}

async function loadAllData() {
	await Promise.all([
		loadFriends(),
		loadRequestsReceived(),
		loadRequestsSent(),
		loadGameInvitations()
	]);
	updateStats();
}

async function loadFriends(onlineOnly = false) {
	try {
		const endpoint = onlineOnly ? '/api/friends/online' : '/api/friends/list';
		const response = await authFetch(endpoint);
		const data = await response.json();

		const friends = data.friends || [];

		// Store friends data
		friends.forEach((friend: any) => {
			friendsData.set(friend.id, friend);
		});

		renderFriendsList(friends);
	} catch (error) {
		console.error('Error loading friends:', error);
		showNotification('Failed to load friends', 'error');
	}
}

function renderFriendsList(friends: any[]) {
	const container = document.getElementById('friends-list');
	if (!container) return;

	if (friends.length === 0) {
		container.innerHTML = `
      <div class="text-center text-gray-400 py-8">
        <p>No friends yet. Search for users to add them!</p>
      </div>
    `;
		return;
	}

	// Sort friends: online first
	const sortedFriends = friends.sort((a, b) => {
		if (a.is_online && !b.is_online) return -1;
		if (!a.is_online && b.is_online) return 1;
		return 0;
	});

	container.innerHTML = sortedFriends.map(friend => `
    <div class="group flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-gray-800/60 to-gray-800/40 border border-gray-700 hover:border-cyan-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 hover:translate-x-1">
      <div class="flex items-center gap-3">
        <div class="relative">
          <img
            src="${friend.avatar_url || '/uploads/default-avatar.jpg'}"
            alt="${friend.username}"
            class="w-14 h-14 rounded-full border-2 ${friend.is_online ? 'border-green-400 shadow-lg shadow-green-500/30' : 'border-gray-600'} object-cover"
            onerror="this.src='/uploads/default-avatar.jpg'"
          />
          <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-900 ${friend.is_online ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}"></div>
        </div>
        <div>
          <div class="font-semibold text-white text-lg">${friend.display_name || friend.username}</div>
          <div class="text-sm text-gray-400">@${friend.username}</div>
          <div class="flex items-center gap-1.5 text-xs ${friend.is_online ? 'text-green-400' : 'text-gray-500'} mt-1">
            <span class="${friend.is_online ? 'animate-pulse' : ''}">●</span>
            <span>${friend.is_online ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>
      <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          data-view-profile="${friend.username}"
          class="px-3 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg transition-all duration-200 shadow-md hover:shadow-blue-500/50 font-medium"
          title="View profile"
        >
          👤 Profile
        </button>
        <button
          data-remove="${friend.username}"
          class="px-3 py-2 text-sm bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-lg transition-all duration-200 shadow-md hover:shadow-red-500/50 font-medium"
          title="Remove friend"
        >
          ✖ Remove
        </button>
      </div>
    </div>
  `).join('');

	// Setup button event listeners
	setupFriendActions();
}

async function loadRequestsReceived() {
	try {
		const response = await authFetch('/api/friends/requests/received');
		const data = await response.json();
		const requests = data.requests || [];

		console.log('📥 Received friend requests:', requests);

		const container = document.getElementById('requests-received');
		if (!container) {
			console.error('❌ requests-received container not found');
			return;
		}

		if (requests.length === 0) {
			container.innerHTML = '<div class="text-gray-400 text-sm text-center py-4">No pending requests</div>';
			return;
		}

		container.innerHTML = requests.map((req: any) => `
      <div class="p-3 rounded-xl bg-gray-800/60 border border-yellow-400/20 hover:border-yellow-400/40 transition-all duration-200 hover:shadow-md hover:shadow-yellow-500/10">
        <div class="flex items-center gap-2 mb-3">
          <img
            src="${req.avatar_url || '/uploads/default-avatar.jpg'}"
            alt="${req.username}"
            class="w-10 h-10 rounded-full border-2 border-yellow-400/30 object-cover"
            onerror="this.src='/uploads/default-avatar.jpg'"
          />
          <div class="flex-1 text-sm">
            <div class="font-semibold text-white">${req.display_name || req.username}</div>
            <div class="text-xs text-gray-400">@${req.username}</div>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            data-accept="${req.id}"
            class="flex-1 px-3 py-2 text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg transition-all duration-200 font-medium shadow-md hover:shadow-green-500/30"
          >
            ✓ Accept
          </button>
          <button
            data-reject="${req.id}"
            class="flex-1 px-3 py-2 text-sm bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 rounded-lg transition-all duration-200 font-medium"
          >
            ✖ Reject
          </button>
        </div>
      </div>
    `).join('');

		setupRequestActions();
	} catch (error) {
		console.error('Error loading requests:', error);
	}
}

async function loadRequestsSent() {
	try {
		const response = await authFetch('/api/friends/requests/sent');
		const data = await response.json();
		const requests = data.requests || [];

		const container = document.getElementById('requests-sent');
		if (!container) return;

		if (requests.length === 0) {
			container.innerHTML = '<div class="text-gray-400 text-sm text-center py-4">No sent requests</div>';
			return;
		}

		container.innerHTML = requests.map((req: any) => `
      <div class="p-3 rounded-lg bg-gray-800/40 border border-gray-700">
        <div class="flex items-center gap-2">
          <img
            src="${req.avatar_url || '/uploads/default-avatar.jpg'}"
            alt="${req.username}"
            class="w-8 h-8 rounded-full border border-gray-600"
          />
          <div class="flex-1 text-sm">
            <div class="font-semibold text-white">${req.display_name || req.username}</div>
            <div class="text-xs text-gray-400">Pending...</div>
          </div>
        </div>
      </div>
    `).join('');
	} catch (error) {
		console.error('Error loading sent requests:', error);
	}
}

async function loadGameInvitations() {
	try {
		const response = await authFetch('/api/friends/invitations');
		const data = await response.json();
		const invitations = data.invitations || [];

		const container = document.getElementById('game-invitations');
		if (!container) return;

		if (invitations.length === 0) {
			container.innerHTML = '<div class="text-gray-400 text-sm text-center py-4">No invites</div>';
			return;
		}

		container.innerHTML = invitations.map((inv: any) => `
      <div class="p-3 rounded-lg bg-gray-800/40 border border-pink-400/30 space-y-3">
        <div class="text-sm font-semibold text-white">
          ${inv.sender_display_name || inv.sender_username}
        </div>
        <div class="flex gap-2">
          <button
            data-accept-invite="${inv.id}"
            class="flex-1 px-3 py-2 text-sm bg-pink-600/80 hover:bg-pink-600 rounded transition-colors font-medium"
          >
            🎮 Join Game
          </button>
          <button
            data-decline-invite="${inv.id}"
            class="px-3 py-2 text-sm bg-gray-700/80 hover:bg-gray-700 rounded transition-colors font-medium"
          >
            ✖ Decline
          </button>
        </div>
      </div>
    `).join('');

		setupInviteActions();
	} catch (error) {
		console.error('Error loading invitations:', error);
	}
}

async function updateStats() {
	const totalFriends = friendsData.size;
	const onlineFriends = Array.from(friendsData.values()).filter(f => f.is_online).length;

	// Fetch pending and sent requests counts
	let pendingCount = 0;
	let sentCount = 0;

	try {
		const [receivedRes, sentRes] = await Promise.all([
			authFetch('/api/friends/requests/received'),
			authFetch('/api/friends/requests/sent')
		]);

		if (receivedRes.ok) {
			const receivedData = await receivedRes.json();
			pendingCount = (receivedData.requests || []).length;
		}

		if (sentRes.ok) {
			const sentData = await sentRes.json();
			sentCount = (sentData.requests || []).length;
		}
	} catch (error) {
		console.error('Error fetching request counts:', error);
	}

	const totalEl = document.getElementById('total-friends');
	const onlineEl = document.getElementById('online-friends');
	const pendingEl = document.getElementById('pending-requests');
	const sentEl = document.getElementById('sent-requests');

	if (totalEl) totalEl.textContent = totalFriends.toString();
	// Update online count - preserve the pulsing indicator
	if (onlineEl) {
		const pulseIndicator = onlineEl.querySelector('.relative.flex') as HTMLElement;
		if (pulseIndicator) {
			onlineEl.innerHTML = '';
			onlineEl.appendChild(pulseIndicator);
			onlineEl.appendChild(document.createTextNode(onlineFriends.toString()));
		} else {
			onlineEl.textContent = onlineFriends.toString();
		}
	}
	if (pendingEl) pendingEl.textContent = pendingCount.toString();
	if (sentEl) sentEl.textContent = sentCount.toString();
}

function updateFriendOnlineStatus(userId: number, isOnline: boolean) {
	const friend = friendsData.get(userId);
	if (friend) {
		friend.is_online = isOnline;
		friendsData.set(userId, friend);

		// Update stats immediately
		updateStats();

		// Re-render friends list if currently visible
		const filterOnlineBtn = document.getElementById('filter-online') as HTMLButtonElement;
		const currentFilter = filterOnlineBtn?.classList.contains('bg-cyan-600');
		loadFriends(currentFilter || false);
	}
}

function setupEventListeners() {
	// Search functionality
	const searchBtn = document.getElementById('search-btn');
	const searchInput = document.getElementById('search-input') as HTMLInputElement;

	searchBtn?.addEventListener('click', () => performSearch());
	searchInput?.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') performSearch();
	});

	// Filter buttons
	document.getElementById('filter-all')?.addEventListener('click', () => {
		document.getElementById('filter-all')?.classList.add('bg-cyan-600');
		document.getElementById('filter-all')?.classList.remove('bg-gray-700');
		document.getElementById('filter-online')?.classList.remove('bg-cyan-600');
		document.getElementById('filter-online')?.classList.add('bg-gray-700');
		loadFriends(false);
	});

	document.getElementById('filter-online')?.addEventListener('click', () => {
		document.getElementById('filter-online')?.classList.add('bg-cyan-600');
		document.getElementById('filter-online')?.classList.remove('bg-gray-700');
		document.getElementById('filter-all')?.classList.remove('bg-cyan-600');
		document.getElementById('filter-all')?.classList.add('bg-gray-700');
		loadFriends(true);
	});
}

async function performSearch() {
	const searchInput = document.getElementById('search-input') as HTMLInputElement;
	const query = searchInput?.value.trim();

	if (!query || query.length < 2) {
		showNotification('Please enter at least 2 characters', 'error');
		return;
	}

	try {
		const response = await authFetch(`/api/friends/search?query=${encodeURIComponent(query)}`);
		const data = await response.json();
		const users = data.users || [];

		const resultsContainer = document.getElementById('search-results');
		if (!resultsContainer) return;

		if (users.length === 0) {
			resultsContainer.innerHTML = '<div class="text-gray-400 text-sm py-2">No users found</div>';
			return;
		}

		resultsContainer.innerHTML = `
      <div class="space-y-2 max-h-64 overflow-y-auto">
        ${users.map((user: any) => `
          <div class="flex items-center justify-between p-2 rounded bg-gray-800/60 border border-gray-700">
            <div class="flex items-center gap-2">
              <img
                src="${user.avatar_url || '/uploads/default-avatar.jpg'}"
                alt="${user.username}"
                class="w-8 h-8 rounded-full border border-gray-600"
              />
              <div class="text-sm">
                <div class="font-semibold text-white">${user.display_name || user.username}</div>
                <div class="text-xs text-gray-400">@${user.username}</div>
              </div>
            </div>
            <div>
              ${user.is_friend ? `
                <span class="px-2 py-1 text-xs bg-green-600/50 text-green-200 rounded">Friends</span>
              ` : user.request_sent ? `
                <span class="px-2 py-1 text-xs bg-yellow-600/50 text-yellow-200 rounded">Pending</span>
              ` : user.request_received ? `
                <button data-accept-search="${user.id}" class="px-2 py-1 text-xs bg-green-600/80 hover:bg-green-600 rounded">Accept</button>
              ` : `
                <button data-add-friend="${user.username}" class="px-2 py-1 text-xs bg-cyan-600/80 hover:bg-cyan-600 rounded">Add Friend</button>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    `;

		setupSearchActions();
	} catch (error) {
		console.error('Error searching users:', error);
		showNotification('Search failed', 'error');
	}
}

function setupFriendActions() {
	// Remove friend
	document.querySelectorAll('[data-remove]').forEach(btn => {
		btn.addEventListener('click', async () => {
			const username = btn.getAttribute('data-remove');
			if (!username) return;

			if (confirm(`Remove ${username} from your friends?`)) {
				try {
					const response = await authFetch(`/api/friends/${encodeURIComponent(username)}`, {
						method: 'DELETE'
					});

					if (response.ok) {
						showNotification('Friend removed', 'success');
						loadAllData();
					}
				} catch (error) {
					showNotification('Failed to remove friend', 'error');
				}
			}
		});
	});

	// View profile
	document.querySelectorAll('[data-view-profile]').forEach(btn => {
		btn.addEventListener('click', () => {
			const username = btn.getAttribute('data-view-profile');
			if (username) {
				window.history.pushState({}, '', `/profile?username=${username}`);
				window.dispatchEvent(new PopStateEvent('popstate'));
			}
		});
	});

	// Invite to game
	document.querySelectorAll('[data-invite]').forEach(btn => {
		btn.addEventListener('click', async () => {
			const friendId = btn.getAttribute('data-invite');
			if (!friendId) return;

			// Show options: Quick match or Tournament
			const choice = await showInviteOptionsDialog();

			if (choice === 'quick') {
				// Send quick game invitation
				try {
					const response = await authFetch('/api/friends/invite', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							friend_id: parseInt(friendId),
							room_code: `game_${Date.now()}`
						})
					});

					if (response.ok) {
						showNotification('Game invitation sent!', 'success');
					}
				} catch (error) {
					showNotification('Failed to send invitation', 'error');
				}
			} else if (choice === 'tournament') {
				// Navigate to tournament page to create one
				const friend = friendsData.get(parseInt(friendId));
				if (friend) {
					// Store pending invite
					localStorage.setItem('pendingTournamentInvite', JSON.stringify({
						friendId: parseInt(friendId),
						username: friend.username
					}));

					// Navigate to tournament page
					window.history.pushState({}, '', '/tournament?createForFriend=true');
					window.dispatchEvent(new PopStateEvent('popstate'));
				}
			}
		});
	});
}

async function acceptFriendRequestById(requestId: number): Promise<boolean> {
	if (!requestId) return false;

	try {
		const response = await authFetch(`/api/friends/request/${requestId}/accept`, {
			method: 'POST'
		});

		if (response.ok) {
			showNotification('Friend request accepted!', 'success');
			await loadAllData();
			return true;
		}

		const data = await response.json().catch(() => ({}));
		showNotification((data && data.error) || 'Failed to accept request', 'error');
	} catch (error) {
		console.error('Failed to accept friend request:', error);
		showNotification('Failed to accept request', 'error');
	}
	return false;
}

async function rejectFriendRequestById(requestId: number): Promise<boolean> {
	if (!requestId) return false;

	try {
		const response = await authFetch(`/api/friends/request/${requestId}/reject`, {
			method: 'POST'
		});

		if (response.ok) {
			showNotification('Friend request rejected', 'info');
			await loadAllData();
			return true;
		}

		const data = await response.json().catch(() => ({}));
		showNotification((data && data.error) || 'Failed to reject request', 'error');
	} catch (error) {
		console.error('Failed to reject friend request:', error);
		showNotification('Failed to reject request', 'error');
	}
	return false;
}

async function acceptGameInvitationById(invitationId: number): Promise<boolean> {
	if (!invitationId) return false;

	try {
		const response = await authFetch(`/api/friends/invitation/${invitationId}/accept`, {
			method: 'POST'
		});
		const data = await response.json().catch(() => ({}));

		if (response.ok && data && data.room_code) {
			window.history.pushState({}, '', `/game-online?code=${data.room_code}`);
			window.dispatchEvent(new PopStateEvent('popstate'));
			await loadGameInvitations();
			return true;
		}

		showNotification((data && data.error) || 'Failed to accept invitation', 'error');
	} catch (error) {
		console.error('Failed to accept game invitation:', error);
		showNotification('Failed to accept invitation', 'error');
	}
	return false;
}

async function rejectGameInvitationById(invitationId: number): Promise<boolean> {
	if (!invitationId) return false;

	try {
		const response = await authFetch(`/api/friends/invitation/${invitationId}/reject`, {
			method: 'POST'
		});

		if (response.ok) {
			showNotification('Invitation declined', 'info');
			await loadGameInvitations();
			return true;
		}

		const data = await response.json().catch(() => ({}));
		showNotification((data && data.error) || 'Failed to decline invitation', 'error');
	} catch (error) {
		console.error('Failed to decline game invitation:', error);
		showNotification('Failed to decline invitation', 'error');
	}
	return false;
}

function setupRequestActions() {
	// Accept request
	document.querySelectorAll('[data-accept]').forEach(btn => {
		btn.addEventListener('click', async () => {
			const id = btn.getAttribute('data-accept');
			if (!id) return;

			await acceptFriendRequestById(Number(id));
		});
	});

	// Reject request
	document.querySelectorAll('[data-reject]').forEach(btn => {
		btn.addEventListener('click', async () => {
			const id = btn.getAttribute('data-reject');
			if (!id) return;

			await rejectFriendRequestById(Number(id));
		});
	});
}

function setupSearchActions() {
	// Add friend from search
	document.querySelectorAll('[data-add-friend]').forEach(btn => {
		btn.addEventListener('click', async () => {
			const username = btn.getAttribute('data-add-friend');
			if (!username) return;

			try {
				const response = await authFetch('/api/friends/request', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ username })
				});

				const data = await response.json();
				if (response.ok) {
					showNotification('Friend request sent!', 'success');
					performSearch(); // Refresh search results
					loadAllData();
				} else {
					// Show backend error message (e.g., "User not found", "Already friends", etc.)
					const errorMsg = data.error || data.message || 'Failed to send friend request';
					showNotification(errorMsg, 'error');
					console.error('Friend request error:', errorMsg);
					performSearch(); // Refresh search results to update button state
				}
			} catch (error) {
				showNotification('Failed to send friend request', 'error');
			}
		});
	});
}

function setupInviteActions() {
	document.querySelectorAll('[data-accept-invite]').forEach(btn => {
		btn.addEventListener('click', async () => {
			const id = btn.getAttribute('data-accept-invite');
			if (!id) return;

			await acceptGameInvitationById(Number(id));
		});
	});

	document.querySelectorAll('[data-decline-invite]').forEach(btn => {
		btn.addEventListener('click', async () => {
			const id = btn.getAttribute('data-decline-invite');
			if (!id) return;

			await rejectGameInvitationById(Number(id));
		});
	});
}

function showInviteOptionsDialog(): Promise<'quick' | 'tournament' | null> {
	return new Promise((resolve) => {
		const dialog = document.createElement('div');
		dialog.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]';
		dialog.innerHTML = `
			<div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-cyan-400/50 shadow-2xl max-w-md w-full mx-4 animate-scale-in">
				<h3 class="text-2xl font-bold text-cyan-400 mb-4 text-center">🎮 Invite to Game</h3>
				<p class="text-gray-300 mb-6 text-center">Choose how you want to play with your friend</p>

				<div class="space-y-3">
					<button id="invite-quick" class="w-full px-6 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-cyan-500/50 flex items-center justify-between group">
						<span>⚡ Quick Match</span>
						<span class="text-sm font-normal opacity-80 group-hover:opacity-100">1v1 Game</span>
					</button>

					<button id="invite-tournament" class="w-full px-6 py-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-yellow-500/50 flex items-center justify-between group">
						<span>🏆 Tournament</span>
						<span class="text-sm font-normal opacity-80 group-hover:opacity-100">Create Bracket</span>
					</button>

					<button id="invite-cancel" class="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-all duration-200">
						Cancel
					</button>
				</div>
			</div>
		`;

		document.body.appendChild(dialog);

		const cleanup = () => {
			dialog.remove();
		};

		dialog.querySelector('#invite-quick')?.addEventListener('click', () => {
			cleanup();
			resolve('quick');
		});

		dialog.querySelector('#invite-tournament')?.addEventListener('click', () => {
			cleanup();
			resolve('tournament');
		});

		dialog.querySelector('#invite-cancel')?.addEventListener('click', () => {
			cleanup();
			resolve(null);
		});

		// Close on background click
		dialog.addEventListener('click', (e) => {
			if (e.target === dialog) {
				cleanup();
				resolve(null);
			}
		});
	});
}

// Track recent notifications to prevent duplicates
const recentNotifications = new Map<string, number>();

function showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
	const container = document.getElementById('notification-area');
	if (!container) return;

	// Prevent duplicate notifications within 2 seconds
	const notificationKey = `${type}:${message}`;
	const now = Date.now();
	const lastShown = recentNotifications.get(notificationKey);

	if (lastShown && now - lastShown < 2000) {
		console.log('⏭️ Skipping duplicate notification:', message);
		return;
	}

	recentNotifications.set(notificationKey, now);

	// Clean up old entries
	setTimeout(() => {
		recentNotifications.delete(notificationKey);
	}, 2000);

	// Limit to max 3 notifications at once
	const existingNotifications = container.children;
	if (existingNotifications.length >= 3) {
		existingNotifications[0].remove();
	}

	const colors = {
		success: 'bg-green-600 border-green-400',
		error: 'bg-red-600 border-red-400',
		info: 'bg-blue-600 border-blue-400',
		warning: 'bg-yellow-600 border-yellow-400'
	};

	const notification = document.createElement('div');
	notification.className = `${colors[type]} border rounded-lg p-4 shadow-lg animate-slide-in max-w-sm`;
	notification.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-white font-semibold">${message}</span>
    </div>
  `;

	container.appendChild(notification);

	setTimeout(() => {
		notification.classList.add('animate-slide-out');
		setTimeout(() => notification.remove(), 300);
	}, 3000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
	socket?.disconnect();
});

// Export cleanup function for router
export function cleanup() {
	console.log('🧹 Cleaning up friends page');
	if (socket) {
		socket.disconnect();
		socket = null;
	}
	friendsData.clear();
}

