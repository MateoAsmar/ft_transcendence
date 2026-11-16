import { authFetch } from '../../shared/auth';

interface UserProfile {
    displayname: string;
    email: string;
    picture: string;
    createdAt: string;
    username: string;
    auth_provider: string;
    oauth_avatar_url: string;
}

interface UserStats {
    total_games: number;
    wins: number;
    losses: number;
}

interface MatchHistory {
    game_id: number;
    opponent: string;
    my_score: number;
    opponent_score: number;
    result: 'win' | 'loss' | 'draw';
    played_at: string;
}

class ProfileManager {
    private userProfile: UserProfile | null = null;
    private userStats: UserStats | null = null;
    private matchHistory: MatchHistory[] = [];
    private currentPage: number = 1;
    private limit: number = 10;
    private totalPages: number = 1;
    private totalMatches: number = 0;

    constructor() {
        this.init();
    }

    private async init() {
        this.setupEventListeners();
        this.setupSidebar();
        await this.loadUserData();
    }

    private setupEventListeners() {
        // Edit profile modal
        document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
            this.openEditModal();
        });

        document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
            this.closeEditModal();
        });

        document.getElementById('save-profile-btn')?.addEventListener('click', () => {
            this.saveProfile();
        });

        // Avatar actions
        document.getElementById('edit-avatar-btn')?.addEventListener('click', () => {
            this.openEditModal();
        });

        document.getElementById('reset-avatar-btn')?.addEventListener('click', () => {
            this.resetAvatar();
        });

        // File upload
        document.getElementById('upload-avatar')?.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files[0]) {
                this.uploadAvatar(target.files[0]);
            }
        });

        // Logout
        document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => {
            this.logout();
        });

        // Modal overlay click
        document.getElementById('edit-modal')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeEditModal();
            }
        });
    }

    private setupSidebar() {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        sidebarToggle?.addEventListener('click', () => {
            sidebar?.classList.toggle('-translate-x-full');
            overlay?.classList.toggle('hidden');
        });

        overlay?.addEventListener('click', () => {
            sidebar?.classList.add('-translate-x-full');
            overlay?.classList.add('hidden');
        });
    }

    private async loadUserData() {
        try {
            // Load profile
            const profileResponse = await authFetch('/api/profile/me');
            if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                if (profileData && !profileData.error) {
                    this.userProfile = profileData;
                    this.updateProfileUI();
                }
            }

            // Load stats
            const statsResponse = await authFetch('/api/profile/stats');
            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                if (statsData && !statsData.error) {
                    this.userStats = statsData;
                    this.updateStatsUI();
                }
            }

            // Load match history
            await this.loadMatchHistory(1);

        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    private updateProfileUI() {
        if (!this.userProfile) return;

        const avatar = document.getElementById('user-avatar') as HTMLImageElement;
        const displayName = document.getElementById('user-displayname');
        const username = document.getElementById('user-username');
        const authBadge = document.getElementById('auth-provider-badge');
        const authText = document.getElementById('auth-provider-text');

        if (avatar) {
            const avatarUrl = this.userProfile.picture;
            if (avatarUrl && avatarUrl.trim() !== '') {
                // Test if the image loads, fallback to default if it fails
                avatar.src = avatarUrl;
                avatar.onerror = () => {
                    avatar.src = '/uploads/default-avatar.jpg';
                };
            } else {
                avatar.src = '/uploads/default-avatar.jpg';
            }
        }
        if (displayName) displayName.textContent = this.userProfile.displayname;
        if (username) username.textContent = `@${this.userProfile.username}`;

        // Show OAuth badge if not manual
        if (this.userProfile.auth_provider !== 'manual') {
            authBadge?.classList.remove('hidden');
            if (authText) {
                authText.textContent = this.userProfile.auth_provider === 'google' ? 'Google Account' : '42 Account';
            }
        }
    }

    private updateStatsUI() {
        if (!this.userStats) return;

        const totalGames = document.getElementById('total-games');
        const totalWins = document.getElementById('total-wins');
        const winRate = document.getElementById('win-rate');

        if (totalGames) totalGames.textContent = this.userStats.total_games.toString();
        if (totalWins) totalWins.textContent = this.userStats.wins.toString();
        
        if (winRate) {
            const rate = this.userStats.total_games > 0 
                ? Math.round((this.userStats.wins / this.userStats.total_games) * 100)
                : 0;
            winRate.textContent = `${rate}%`;
        }
    }

    private async loadMatchHistory(page: number) {
        try {
            const response = await authFetch(`/api/profile/history?page=${page}&limit=${this.limit}`);
            if (!response.ok) {
                throw new Error('Failed to load match history');
            }
            const historyData = await response.json();
            console.log('📊 Match history data:', historyData);

            if (historyData && !historyData.error) {
                this.matchHistory = historyData.history || [];
                this.currentPage = historyData.pagination?.page || 1;
                this.totalPages = historyData.pagination?.totalPages || 1;
                this.totalMatches = historyData.pagination?.total || 0;

                console.log('📊 Pagination state:', {
                    currentPage: this.currentPage,
                    totalPages: this.totalPages,
                    totalMatches: this.totalMatches,
                    matchesCount: this.matchHistory.length
                });

                this.updateHistoryUI();
            }
        } catch (error) {
            console.error('Error loading match history:', error);
        }
    }

    private updateHistoryUI() {
        const historyContainer = document.getElementById('history');
        if (!historyContainer) {
            console.error('❌ History container not found!');
            return;
        }

        console.log('✅ Rendering history UI with', this.matchHistory.length, 'matches');

        if (this.matchHistory.length === 0) {
            historyContainer.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    No matches played yet. <a data-link href="/game" class="text-cyan-400 hover:underline">Start playing!</a>
                </div>
            `;
            return;
        }

        const matchesHTML = this.matchHistory.map(match => `
            <div class="flex items-center justify-between p-4 bg-gray-800/50 rounded border border-gray-700">
                <div class="flex items-center gap-4">
                    <div class="w-3 h-3 rounded-full ${match.result === 'win' ? 'bg-green-400' : match.result === 'loss' ? 'bg-red-400' : 'bg-gray-400'}"></div>
                    <div>
                        <p class="text-white font-medium">vs ${match.opponent || 'AI'}</p>
                        <p class="text-gray-400 text-sm">${new Date(match.played_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-white font-bold">${match.my_score} - ${match.opponent_score}</p>
                    <p class="text-sm ${match.result === 'win' ? 'text-green-400' : match.result === 'loss' ? 'text-red-400' : 'text-gray-400'}">
                        ${match.result.toUpperCase()}
                    </p>
                </div>
            </div>
        `).join('');

        const paginationHTML = this.totalPages > 1 ? `
            <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                <button id="prev-page" ${this.currentPage === 1 ? 'disabled' : ''}
                    class="px-4 py-2 bg-cyan-600/80 hover:bg-cyan-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-sm font-medium transition-all">
                    Previous
                </button>
                <div class="text-gray-400 text-sm">
                    Page ${this.currentPage} of ${this.totalPages} <span class="text-gray-500">(${this.totalMatches} total)</span>
                </div>
                <button id="next-page" ${this.currentPage === this.totalPages ? 'disabled' : ''}
                    class="px-4 py-2 bg-cyan-600/80 hover:bg-cyan-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-sm font-medium transition-all">
                    Next
                </button>
            </div>
        ` : '';

        historyContainer.innerHTML = matchesHTML + paginationHTML;

        // Add event listeners for pagination buttons
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.loadMatchHistory(this.currentPage - 1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.loadMatchHistory(this.currentPage + 1));
        }
    }

    private openEditModal() {
        if (!this.userProfile) return;

        const modal = document.getElementById('edit-modal');
        const usernameInput = document.getElementById('edit-username') as HTMLInputElement;
        const displayNameInput = document.getElementById('edit-displayname') as HTMLInputElement;
        const avatarUrlInput = document.getElementById('edit-avatar-url') as HTMLInputElement;
        const usernameReadonly = document.getElementById('username-readonly');
        const displayNameReadonly = document.getElementById('displayname-readonly');

        if (usernameInput) {
            usernameInput.value = this.userProfile.username;
            usernameInput.disabled = this.userProfile.auth_provider !== 'manual';
        }

        if (displayNameInput) {
            displayNameInput.value = this.userProfile.displayname;
            displayNameInput.disabled = this.userProfile.auth_provider !== 'manual';
        }

        if (avatarUrlInput) {
            avatarUrlInput.value = '';
        }

        // Show/hide readonly messages
        if (this.userProfile.auth_provider !== 'manual') {
            usernameReadonly?.classList.remove('hidden');
            displayNameReadonly?.classList.remove('hidden');
        } else {
            usernameReadonly?.classList.add('hidden');
            displayNameReadonly?.classList.add('hidden');
        }

        modal?.classList.remove('hidden');
    }

    private closeEditModal() {
        const modal = document.getElementById('edit-modal');
        modal?.classList.add('hidden');
    }

    private async saveProfile() {
        const usernameInput = document.getElementById('edit-username') as HTMLInputElement;
        const displayNameInput = document.getElementById('edit-displayname') as HTMLInputElement;
        const avatarUrlInput = document.getElementById('edit-avatar-url') as HTMLInputElement;

        const updates: any = {};

        if (usernameInput && usernameInput.value && !usernameInput.disabled) {
            updates.username = usernameInput.value;
        }

        if (displayNameInput && displayNameInput.value && !displayNameInput.disabled) {
            updates.display_name = displayNameInput.value;
        }

        if (avatarUrlInput && avatarUrlInput.value) {
            updates.avatar_url = avatarUrlInput.value;
        }

        if (Object.keys(updates).length === 0) {
            this.closeEditModal();
            return;
        }

        try {
            const response = await authFetch('/api/profile/me', {
                method: 'PUT',
                body: JSON.stringify(updates),
            });

            const result = await response.json();
            console.log('Profile update result:', result);

            if (response.ok && result && result.success) {
                await this.loadUserData(); // Reload profile data
                this.closeEditModal();
                this.showToast(result.message || 'Profile updated successfully!', 'success');
            } else {
                this.showToast(result.message || result.error || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            this.showToast('Failed to update profile', 'error');
        }
    }

    private async uploadAvatar(file: File) {
        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const response = await authFetch('/api/profile/upload-avatar', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok && result && !result.error) {
                await this.loadUserData(); // Reload profile data
                this.closeEditModal();
                this.showToast('Avatar uploaded successfully!', 'success');
            } else {
                this.showToast(result.error || 'Failed to upload avatar', 'error');
            }
        } catch (error) {
            this.showToast('Failed to upload avatar', 'error');
        }
    }

    private async resetAvatar() {
        if (!confirm('Are you sure you want to reset your avatar?')) return;

        try {
            const response = await authFetch('/api/profile/avatar', {
                method: 'DELETE',
            });

            const result = await response.json();
            if (response.ok && result && !result.error) {
                await this.loadUserData(); // Reload profile data
                this.showToast('Avatar reset successfully!', 'success');
            } else {
                this.showToast(result.error || 'Failed to reset avatar', 'error');
            }
        } catch (error) {
            this.showToast('Failed to reset avatar', 'error');
        }
    }

    private logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        window.location.href = '/login';
    }

    private showToast(message: string, type: 'success' | 'error') {
        console.log(`🍞 Toast: [${type}] ${message}`);

        // Create toast notification with higher z-index and shadow
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg border-2 shadow-2xl font-semibold ${
            type === 'success'
                ? 'bg-green-600 border-green-400 text-white'
                : 'bg-red-600 border-red-400 text-white'
        }`;
        toast.style.zIndex = '9999';
        toast.textContent = message;

        document.body.appendChild(toast);

        // Fade in animation
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease-out';

        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);

        // Remove after 4 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    new ProfileManager();
});
