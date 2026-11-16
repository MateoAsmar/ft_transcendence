// Friend List Management System
import { io, Socket } from 'socket.io-client';
import { navigateSpa } from '../../shared/navigation';

const API_BASE_URL = '/api';
let socket: Socket | null = null;

interface Friend {
	id: number;
	username: string;
	display_name: string;
	avatar_url: string;
	friend_since: string;
}

interface FriendRequest {
	id: number;
	sender_id: number;
	username: string;
	display_name: string;
	avatar_url: string;
	created_at: string;
}

interface SearchResult {
	id: number;
	username: string;
	display_name: string;
	avatar_url: string;
	is_friend: boolean;
	request_sent: boolean;
	request_received: boolean;
}

interface GameInvitation {
	id: number;
	sender_id: number;
	sender_username: string;
	sender_display_name: string;
	room_code: string;
	status: string;
	created_at: string;
	expires_at: string;
}

// API helper
async function apiRequest(endpoint: string, options: RequestInit = {}) {
	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options.headers,
		},
		credentials: 'include'
	});

	if (response.status === 401) {
		localStorage.removeItem('authToken');
		navigateSpa('/login');
		throw new Error('Session expired');
	}

	return response.json();
}

// Show notification
function showNotification(message: string, isError = false) {
	const notification = document.createElement('div');
	notification.className = `notification ${isError ? 'error' : ''}`;
	notification.textContent = message;
	document.body.appendChild(notification);

	setTimeout(() => {
		notification.remove();
	}, 3000);
}

// Initialize Socket.IO connection
function initializeSocket() {
	// Connect via same origin so cookies are sent
	socket = io('/', {
		path: '/socket.io',
		transports: ['websocket', 'polling'],
		withCredentials: true
	});

	socket.on('connect', () => {
		console.log('Friends page socket connected');
	});

	socket.on('authenticated', (data) => {
		console.log('Friends page socket authenticated:', data);
	});

	// Listen for custom events dispatched by notification manager
	window.addEventListener('friendRequestReceived', () => {
		console.log('📩 Friend request received event - refreshing lists');
		loadFriendRequests();
		updateRequestsBadge();
	});

	window.addEventListener('friendRequestAcceptedFromNotification', () => {
		console.log('✅ Friend request accepted from notification - refreshing lists');
		loadFriendRequests();
		loadFriends();
		updateRequestsBadge();
	});

	window.addEventListener('friendRequestRejectedFromNotification', () => {
		console.log('❌ Friend request rejected from notification - refreshing lists');
		loadFriendRequests();
		updateRequestsBadge();
	});

	window.addEventListener('friendRequestAccepted', () => {
		console.log('✅ Friend request accepted event - refreshing friends');
		loadFriends();
	});

	window.addEventListener('friendRemoved', () => {
		console.log('👋 Friend removed event - refreshing friends');
		loadFriends();
	});

	window.addEventListener('gameInvitation', () => {
		console.log('🎮 Game invitation received - refreshing invitations');
		loadGameInvitations();
		updateInvitationsBadge();
	});
}

// Tab switching
function setupTabs() {
	const tabs = document.querySelectorAll('.tab');
	const tabContents = document.querySelectorAll('.tab-content');

	tabs.forEach(tab => {
		tab.addEventListener('click', () => {
			const tabName = tab.getAttribute('data-tab');

			tabs.forEach(t => t.classList.remove('active'));
			tabContents.forEach(tc => tc.classList.remove('active'));

			tab.classList.add('active');
			document.getElementById(`${tabName}-tab`)?.classList.add('active');

			// Load data when switching tabs
			if (tabName === 'friends') loadFriends();
			else if (tabName === 'requests') loadFriendRequests();
			else if (tabName === 'invitations') loadGameInvitations();
		});
	});
}

// Load friends list
async function loadFriends() {
	const loading = document.getElementById('friends-loading')!;
	const listElement = document.getElementById('friends-list')!;

	loading.style.display = 'block';
	listElement.style.display = 'none';

	try {
		const data = await apiRequest('/friends/list');
		const friends: Friend[] = data.friends;

		loading.style.display = 'none';
		listElement.style.display = 'grid';
		listElement.innerHTML = '';

		const badge = document.getElementById('friends-count')!;
		if (friends.length > 0) {
			badge.textContent = friends.length.toString();
			badge.style.display = 'block';
		} else {
			badge.style.display = 'none';
		}

		if (friends.length === 0) {
			listElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👋</div>
                    <div class="empty-state-text">No friends yet. Start by adding some!</div>
                </div>
            `;
			return;
		}

		friends.forEach(friend => {
			const card = createFriendCard(friend);
			listElement.appendChild(card);
		});
	} catch (error) {
		console.error('Error loading friends:', error);
		showNotification('Failed to load friends', true);
	}
}

// Create friend card
function createFriendCard(friend: Friend): HTMLElement {
	const card = document.createElement('div');
	card.className = 'user-card';

	const avatarUrl = friend.avatar_url || '/uploads/default-avatar.jpg';
	const displayName = friend.display_name || friend.username;

	// Online status is handled by backend presence system
	const isOnline = false;

	card.innerHTML = `
        <img src="${avatarUrl}" alt="${friend.username}" class="user-avatar">
        <div class="user-info">
            <div class="user-name">${displayName}</div>
            <div class="user-status">
                <span class="status-indicator ${isOnline ? 'online' : 'offline'}"></span>
                ${isOnline ? 'Online' : 'Offline'}
            </div>
        </div>
        <div class="user-actions">
            <button class="btn btn-primary" onclick="inviteToGame('${friend.username}', ${friend.id})">
                🎮 Game
            </button>
            <button class="btn btn-secondary" onclick="showTournamentInviteModal('${friend.username}', ${friend.id})">
                🏆 Tournament
            </button>
            <button class="btn btn-danger" onclick="removeFriend('${friend.username}')">
                ❌ Remove
            </button>
        </div>
    `;

	return card;
}

// Load friend requests
async function loadFriendRequests() {
	const loading = document.getElementById('requests-loading')!;
	const listElement = document.getElementById('requests-list')!;

	loading.style.display = 'block';
	listElement.style.display = 'none';

	try {
		const data = await apiRequest('/friends/requests/received');
		const requests: FriendRequest[] = data.requests;

		loading.style.display = 'none';
		listElement.style.display = 'grid';
		listElement.innerHTML = '';

		updateRequestsBadge();

		if (requests.length === 0) {
			listElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-text">No pending friend requests</div>
                </div>
            `;
			return;
		}

		requests.forEach(request => {
			const card = createRequestCard(request);
			listElement.appendChild(card);
		});
	} catch (error) {
		console.error('Error loading requests:', error);
		showNotification('Failed to load friend requests', true);
	}
}

// Update requests badge
async function updateRequestsBadge() {
	try {
		const data = await apiRequest('/friends/requests/received');
		const count = data.requests.length;
		const badge = document.getElementById('requests-count')!;

		if (count > 0) {
			badge.textContent = count.toString();
			badge.style.display = 'block';
		} else {
			badge.style.display = 'none';
		}
	} catch (error) {
		console.error('Error updating requests badge:', error);
	}
}

// Create request card
function createRequestCard(request: FriendRequest): HTMLElement {
	const card = document.createElement('div');
	card.className = 'user-card';

	const avatarUrl = request.avatar_url || '/uploads/default-avatar.jpg';
	const displayName = request.display_name || request.username;

	card.innerHTML = `
        <img src="${avatarUrl}" alt="${request.username}" class="user-avatar">
        <div class="user-info">
            <div class="user-name">${displayName}</div>
            <div class="user-status">@${request.username}</div>
        </div>
        <div class="user-actions">
            <button class="btn btn-success" onclick="acceptFriendRequest(${request.id})">
                ✓ Accept
            </button>
            <button class="btn btn-danger" onclick="rejectFriendRequest(${request.id})">
                ✗ Reject
            </button>
        </div>
    `;

	return card;
}

// Search users
let searchTimeout: number | null = null;
function setupSearch() {
	const searchInput = document.getElementById('search-input') as HTMLInputElement;
	const resultsElement = document.getElementById('search-results')!;

	searchInput.addEventListener('input', () => {
		const query = searchInput.value.trim();

		if (searchTimeout) clearTimeout(searchTimeout);

		if (query.length < 2) {
			resultsElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-text">Type at least 2 characters to search</div>
                </div>
            `;
			return;
		}

		searchTimeout = window.setTimeout(async () => {
			try {
				const data = await apiRequest(`/friends/search?query=${encodeURIComponent(query)}`);
				const users: SearchResult[] = data.users;

				resultsElement.innerHTML = '';

				if (users.length === 0) {
					resultsElement.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">😕</div>
                            <div class="empty-state-text">No users found</div>
                        </div>
                    `;
					return;
				}

				users.forEach(user => {
					const card = createSearchResultCard(user);
					resultsElement.appendChild(card);
				});
			} catch (error) {
				console.error('Error searching users:', error);
				showNotification('Failed to search users', true);
			}
		}, 300);
	});
}

// Create search result card
function createSearchResultCard(user: SearchResult): HTMLElement {
	const card = document.createElement('div');
	card.className = 'user-card';

	const avatarUrl = user.avatar_url || '/uploads/default-avatar.jpg';
	const displayName = user.display_name || user.username;

	let actionButton = '';
	if (user.is_friend) {
		actionButton = '<span class="btn btn-secondary" disabled>✓ Friends</span>';
	} else if (user.request_sent) {
		actionButton = '<span class="btn btn-secondary" disabled>⏳ Request Sent</span>';
	} else if (user.request_received) {
		actionButton = `<button class="btn btn-success" onclick="acceptPendingRequest('${user.username}')">✓ Accept Request</button>`;
	} else {
		actionButton = `<button class="btn btn-primary" onclick="sendFriendRequest('${user.username}')">➕ Add Friend</button>`;
	}

	card.innerHTML = `
        <img src="${avatarUrl}" alt="${user.username}" class="user-avatar">
        <div class="user-info">
            <div class="user-name">${displayName}</div>
            <div class="user-status">@${user.username}</div>
        </div>
        <div class="user-actions">
            ${actionButton}
        </div>
    `;

	return card;
}

// Send friend request
(window as any).sendFriendRequest = async function (username: string) {
	try {
		await apiRequest('/friends/request', {
			method: 'POST',
			body: JSON.stringify({ username }),
		});

		showNotification('Friend request sent!');

		// Refresh search results
		const searchInput = document.getElementById('search-input') as HTMLInputElement;
		searchInput.dispatchEvent(new Event('input'));
	} catch (error: any) {
		console.error('Error sending friend request:', error);
		showNotification(error.error || 'Failed to send friend request', true);
	}
};

// Accept friend request
(window as any).acceptFriendRequest = async function (requestId: number) {
	try {
		await apiRequest(`/friends/request/${requestId}/accept`, {
			method: 'POST',
		});

		showNotification('Friend request accepted!');
		loadFriendRequests();
		loadFriends();
	} catch (error) {
		console.error('Error accepting friend request:', error);
		showNotification('Failed to accept friend request', true);
	}
};

// Reject friend request
(window as any).rejectFriendRequest = async function (requestId: number) {
	try {
		await apiRequest(`/friends/request/${requestId}/reject`, {
			method: 'POST',
		});

		showNotification('Friend request rejected');
		loadFriendRequests();
	} catch (error) {
		console.error('Error rejecting friend request:', error);
		showNotification('Failed to reject friend request', true);
	}
};

// Remove friend
(window as any).removeFriend = async function (username: string) {
	if (!confirm(`Are you sure you want to remove ${username} from your friends?`)) {
		return;
	}

	try {
		await apiRequest(`/friends/${username}`, {
			method: 'DELETE',
		});

		showNotification('Friend removed');
		loadFriends();
	} catch (error) {
		console.error('Error removing friend:', error);
		showNotification('Failed to remove friend', true);
	}
};

// Invite friend to game
(window as any).inviteToGame = async function (username: string, friendId: number) {
	try {
		// Create a private room first
		if (!socket) {
			showNotification('Not connected to game server', true);
			return;
		}

		socket.emit('createPrivateRoom');

		socket.once('privateRoomCreated', async (data: { roomCode: string; roomId: string }) => {
			// Send game invitation
			try {
				await apiRequest('/friends/invite', {
					method: 'POST',
					body: JSON.stringify({
						friend_id: friendId,
						room_code: data.roomCode
					}),
				});

				showNotification(`Game invitation sent to ${username}!`);
			} catch (error) {
				console.error('Error sending invitation:', error);
				showNotification('Failed to send game invitation', true);
			}
		});
	} catch (error) {
		console.error('Error inviting to game:', error);
		showNotification('Failed to invite to game', true);
	}
};

// Invite friend to tournament
(window as any).inviteToTournament = async function (username: string, friendId: number, tournamentId: string) {
	try {
		if (!socket) {
			showNotification('Not connected to game server', true);
			return;
		}

		// Send tournament invitation through socket
		socket.emit('inviteToTournament', {
			friendId: friendId,
			tournamentId: tournamentId
		});

		showNotification(`Tournament invitation sent to ${username}!`);
	} catch (error) {
		console.error('Error inviting to tournament:', error);
		showNotification('Failed to invite to tournament', true);
	}
};

// Load game invitations
async function loadGameInvitations() {
	const loading = document.getElementById('invitations-loading')!;
	const listElement = document.getElementById('invitations-list')!;

	loading.style.display = 'block';
	listElement.style.display = 'none';

	try {
		const data = await apiRequest('/friends/invitations');
		const invitations: GameInvitation[] = data.invitations;

		loading.style.display = 'none';
		listElement.style.display = 'grid';
		listElement.innerHTML = '';

		updateInvitationsBadge();

		if (invitations.length === 0) {
			listElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎮</div>
                    <div class="empty-state-text">No game invitations</div>
                </div>
            `;
			return;
		}

		invitations.forEach(invitation => {
			const card = createInvitationCard(invitation);
			listElement.appendChild(card);
		});
	} catch (error) {
		console.error('Error loading invitations:', error);
		showNotification('Failed to load game invitations', true);
	}
}

// Update invitations badge
async function updateInvitationsBadge() {
	try {
		const data = await apiRequest('/friends/invitations');
		const count = data.invitations.length;
		const badge = document.getElementById('invitations-count')!;

		if (count > 0) {
			badge.textContent = count.toString();
			badge.style.display = 'block';
		} else {
			badge.style.display = 'none';
		}
	} catch (error) {
		console.error('Error updating invitations badge:', error);
	}
}

// Create invitation card
function createInvitationCard(invitation: GameInvitation): HTMLElement {
	const card = document.createElement('div');
	card.className = 'user-card';

	const displayName = invitation.sender_display_name || invitation.sender_username;

	card.innerHTML = `
        <div class="user-info" style="flex: 1;">
            <div class="user-name">🎮 Game Invitation from ${displayName}</div>
            <div class="user-status">Room Code: ${invitation.room_code}</div>
        </div>
        <div class="user-actions">
            <button class="btn btn-success" onclick="acceptGameInvitation(${invitation.id}, '${invitation.room_code}')">
                ✓ Join Game
            </button>
        </div>
    `;

	return card;
}

// Accept game invitation
(window as any).acceptGameInvitation = async function (invitationId: number, roomCode: string) {
	try {
		await apiRequest(`/friends/invitation/${invitationId}/accept`, {
			method: 'POST',
		});

		// Redirect to game with room code
		const roomParam = encodeURIComponent(roomCode);
		navigateSpa(`/game-online?code=${roomParam}`);
	} catch (error) {
		console.error('Error accepting invitation:', error);
		showNotification('Failed to join game', true);
	}
};

// Show tournament invitation modal
(window as any).showTournamentInviteModal = function (username: string, friendId: number) {
	// Create modal if it doesn't exist
	let modal = document.getElementById('tournament-invite-modal');
	if (!modal) {
		modal = document.createElement('div');
		modal.id = 'tournament-invite-modal';
		modal.className = 'modal';
		modal.innerHTML = `
			<div class="modal-content">
				<div class="modal-header">
					<h3>🏆 Invite to Tournament</h3>
					<span class="close" onclick="closeTournamentInviteModal()">&times;</span>
				</div>
				<div class="modal-body">
					<p>Invite <strong id="invite-username"></strong> to join your tournament:</p>
					<div id="tournament-options">
						<p>Choose tournament type:</p>
						<div class="tournament-type-buttons">
							<button class="btn btn-primary" onclick="createTournamentForFriend('${username}', ${friendId})">
								Create New Tournament
							</button>
							<button class="btn btn-secondary" onclick="showExistingTournaments('${username}', ${friendId})">
								Invite to Existing Tournament
							</button>
						</div>
					</div>
				</div>
			</div>
		`;
		document.body.appendChild(modal);
	}

	document.getElementById('invite-username')!.textContent = username;
	modal.style.display = 'block';
};

// Close tournament invitation modal
(window as any).closeTournamentInviteModal = function () {
	const modal = document.getElementById('tournament-invite-modal');
	if (modal) {
		modal.style.display = 'none';
	}
};

// Create tournament for friend
(window as any).createTournamentForFriend = function (username: string, friendId: number) {
	// Store friend info for after tournament creation
	localStorage.setItem('pendingTournamentInvite', JSON.stringify({
		username: username,
		friendId: friendId
	}));

	// Close modal and redirect to tournament page
	(window as any).closeTournamentInviteModal();
	navigateSpa('/tournament?createForFriend=true');
};

// Show existing tournaments (placeholder - to be implemented)
(window as any).showExistingTournaments = function (_username: string, _friendId: number) {
	showNotification('Feature coming soon: Browse existing tournaments', false);
	(window as any).closeTournamentInviteModal();
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	setupTabs();
	setupSearch();
	initializeSocket();
	loadFriends();
	updateRequestsBadge();
	updateInvitationsBadge();
});
