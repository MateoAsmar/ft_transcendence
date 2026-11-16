// Global Notification Manager - Handles real-time notifications via Socket.IO
import { io, Socket } from 'socket.io-client';
import { showPopupNotification } from '../notification';
import { navigateSpa } from './navigation';

class NotificationManager {
  private socket: Socket | null = null;
  private isInitialized = false;

  initialize() {
    if (this.isInitialized) {
      console.log('NotificationManager already initialized');
      return;
    }

    // Connect via same origin so cookies are sent
    this.socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('🔔 Notification socket connected (ID:', this.socket?.id, ')');
      console.log('🔔 Using httpOnly cookie authentication');
    });

    this.socket.on('authenticated', (data) => {
      console.log('🔔 Notification socket authenticated:', data);
      if (data.success) {
        console.log('✅ Notification system ready for user:', data.user?.username);
      } else {
        console.error('❌ Notification socket authentication failed:', data.error);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔔 Notification socket disconnected. Reason:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔔 Notification socket connection error:', error.message);
    });

    this.socket.on('error', (error) => {
      console.error('🔔 Notification socket error:', error);
    });

    // Friend Request Received
    this.socket.on('friendRequestReceived', (data: {
      request_id: number;
      sender_id: number;
      sender_username: string;
      sender_display_name?: string;
    }) => {
      const displayName = data.sender_display_name || data.sender_username;
      showPopupNotification(
        `${displayName} sent you a friend request!`,
        'info',
        {
          duration: 10000,
          actions: [
            {
              label: 'Accept',
              variant: 'primary',
              onClick: async (close) => {
                try {
                  console.log(`🔄 Accepting friend request ${data.request_id} from ${displayName}...`);
                  const response = await fetch(`/api/friends/request/${data.request_id}/accept`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  
                  console.log(`📡 Response status: ${response.status}`);
                  const result = await response.json();
                  console.log('📦 Response data:', result);
                  
                  if (response.ok && result.success !== false) {
                    console.log('✅ Friend request accepted successfully');
                    showPopupNotification(`✅ You're now friends with ${displayName}!`, 'success', { duration: 3000 });
                    close();
                    // Dispatch event so friends page can update if it's open
                    window.dispatchEvent(new CustomEvent('friendRequestAcceptedFromNotification', { 
                      detail: { requestId: data.request_id, username: data.sender_username } 
                    }));
                  } else {
                    console.error('❌ Failed to accept request:', response.status, result);
                    showPopupNotification(result.message || 'Failed to accept request', 'error', { duration: 3000 });
                  }
                } catch (error) {
                  console.error('❌ Error accepting friend request:', error);
                  showPopupNotification('Network error. Please try again.', 'error', { duration: 3000 });
                }
              }
            },
            {
              label: 'Reject',
              variant: 'secondary',
              onClick: async (close) => {
                try {
                  console.log(`🔄 Rejecting friend request ${data.request_id} from ${displayName}...`);
                  const response = await fetch(`/api/friends/request/${data.request_id}/reject`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  
                  console.log(`📡 Response status: ${response.status}`);
                  const result = await response.json();
                  console.log('📦 Response data:', result);
                  
                  if (response.ok && result.success !== false) {
                    console.log('✅ Friend request rejected successfully');
                    showPopupNotification('Friend request rejected', 'info', { duration: 2000 });
                    close();
                    // Dispatch event so friends page can update if it's open
                    window.dispatchEvent(new CustomEvent('friendRequestRejectedFromNotification', { 
                      detail: { requestId: data.request_id } 
                    }));
                  } else {
                    console.error('❌ Failed to reject request:', response.status, result);
                    showPopupNotification(result.message || 'Failed to reject request', 'error', { duration: 3000 });
                  }
                } catch (error) {
                  console.error('❌ Error rejecting friend request:', error);
                  showPopupNotification('Network error. Please try again.', 'error', { duration: 3000 });
                }
              }
            },
            {
              label: 'Dismiss',
              variant: 'secondary',
              closeOnClick: true
            }
          ]
        }
      );

      // Dispatch custom event for friends page to refresh
      window.dispatchEvent(new CustomEvent('friendRequestReceived', { detail: data }));
    });

    // Friend Request Accepted
    this.socket.on('friendRequestAccepted', (data: {
      user_id: number;
      username: string;
      display_name?: string;
    }) => {
      const displayName = data.display_name || data.username;
      showPopupNotification(
        `${displayName} accepted your friend request! 🎉`,
        'success',
        {
          duration: 6000,
          actions: [
            {
              label: 'View Friends',
              variant: 'primary',
              onClick: () => {
                navigateSpa('/friends');
              }
            },
            {
              label: 'Dismiss',
              variant: 'secondary',
              closeOnClick: true
            }
          ]
        }
      );

      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('friendRequestAccepted', { detail: data }));
    });

    // Friend Removed
    this.socket.on('friendRemoved', (data: {
      user_id: number;
      username: string;
      display_name?: string;
    }) => {
      const displayName = data.display_name || data.username;
      showPopupNotification(
        `${displayName} removed you from their friends list`,
        'warning',
        {
          duration: 6000
        }
      );

      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('friendRemoved', { detail: data }));
    });

    // Game Invitation Received
    this.socket.on('gameInvitation', (data: {
      invitation_id: number;
      sender_id: number;
      sender_username: string;
      sender_display_name?: string;
      room_code: string;
    }) => {
      const displayName = data.sender_display_name || data.sender_username;
      showPopupNotification(
        `🎮 ${displayName} invited you to play a game!`,
        'info',
        {
          duration: 15000,
          actions: [
            {
              label: 'Join Game',
              variant: 'primary',
              onClick: async () => {
                // Accept the invitation and join
                try {
                  const response = await fetch(`/api/friends/invitation/${data.invitation_id}/accept`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  
                  if (response.ok) {
                    navigateSpa(`/game-online?code=${encodeURIComponent(data.room_code)}`);
                  } else {
                    showPopupNotification('Failed to join game', 'error', { duration: 3000 });
                  }
                } catch (error) {
                  console.error('Error accepting game invitation:', error);
                  showPopupNotification('Failed to join game', 'error', { duration: 3000 });
                }
              }
            },
            {
              label: 'View Later',
              variant: 'secondary',
              onClick: () => {
                navigateSpa('/friends');
              }
            },
            {
              label: 'Dismiss',
              variant: 'secondary',
              closeOnClick: true
            }
          ]
        }
      );

      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('gameInvitation', { detail: data }));
    });

    // Tournament Invitation Received
    this.socket.on('tournamentInvitation', (data: {
      tournamentId: string;
      tournamentName: string;
      inviterUsername: string;
      inviterDisplayName?: string;
      joinCode?: string;
    }) => {
      const displayName = data.inviterDisplayName || data.inviterUsername;
      showPopupNotification(
        `🏆 ${displayName} invited you to join tournament "${data.tournamentName}"!`,
        'info',
        {
          duration: 20000,
          actions: [
            {
              label: 'Join Tournament',
              variant: 'primary',
              onClick: () => {
                if (data.joinCode) {
                  navigateSpa(`/tournament?join=${encodeURIComponent(data.joinCode)}`);
                } else {
                  navigateSpa(`/tournament?id=${encodeURIComponent(data.tournamentId)}`);
                }
              }
            },
            {
              label: 'View Later',
              variant: 'secondary',
              onClick: () => {
                navigateSpa('/tournament');
              }
            },
            {
              label: 'Dismiss',
              variant: 'secondary',
              closeOnClick: true
            }
          ]
        }
      );

      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('tournamentInvitation', { detail: data }));
    });

    // Match Found (from matchmaking)
    this.socket.on('matchFound', (data: {
      roomId: string;
      opponent?: string;
    }) => {
      showPopupNotification(
        `⚡ Match found! ${data.opponent ? `vs ${data.opponent}` : 'Get ready!'}`,
        'success',
        {
          duration: 8000,
          actions: [
            {
              label: 'Join Match',
              variant: 'primary',
              onClick: () => {
                navigateSpa(`/game-online?room=${encodeURIComponent(data.roomId)}`);
              }
            }
          ]
        }
      );
    });

    // Player Joined Your Game
    this.socket.on('playerJoinedYourGame', (data: {
      username: string;
      displayName?: string;
    }) => {
      const displayName = data.displayName || data.username;
      showPopupNotification(
        `${displayName} joined your game!`,
        'success',
        {
          duration: 4000
        }
      );
    });

    // Game Starting Soon
    this.socket.on('gameStartingSoon', (data: {
      seconds: number;
    }) => {
      showPopupNotification(
        `Game starting in ${data.seconds} seconds!`,
        'info',
        {
          duration: 3000
        }
      );
    });

    // Tournament Match Ready
    this.socket.on('tournamentMatchReady', (data: {
      matchId: string;
      opponent?: string;
      round: string;
    }) => {
      showPopupNotification(
        `🏆 Your ${data.round} match is ready! ${data.opponent ? `vs ${data.opponent}` : ''}`,
        'warning',
        {
          duration: 15000,
          actions: [
            {
              label: 'Join Match',
              variant: 'primary',
              onClick: () => {
                navigateSpa(`/game-tournament?match=${encodeURIComponent(data.matchId)}`);
              }
            }
          ]
        }
      );
    });

    this.isInitialized = true;
    console.log('🔔 NotificationManager initialized');
  }

  destroy() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isInitialized = false;
    console.log('🔔 NotificationManager destroyed');
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

// Create singleton instance
export const notificationManager = new NotificationManager();

// Auto-initialize when user is authenticated
export function initializeNotifications() {
  notificationManager.initialize();
}

export function destroyNotifications() {
  notificationManager.destroy();
}
