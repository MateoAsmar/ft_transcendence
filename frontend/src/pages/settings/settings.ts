import { authFetch } from '../../shared/auth';

interface UserSettings {
    aiDifficulty: 'easy' | 'medium' | 'hard';
    gameSpeed: 'slow' | 'normal' | 'fast';
    soundEnabled: boolean;
    profileVisibility: 'public' | 'friends' | 'private';
    showOnlineStatus: boolean;
}

interface UserProfile {
    username: string;
    email: string;
    auth_provider: string;
    display_name: string;
}

class SettingsManager {
    private userSettings: UserSettings = {
        aiDifficulty: 'medium',
        gameSpeed: 'normal',
        soundEnabled: true,
        profileVisibility: 'public',
        showOnlineStatus: true
    };

    constructor() {
        this.init();
    }

    private async init() {
        this.setupEventListeners();
        this.setupSidebar();
        await this.loadUserProfile();
        await this.loadSettings();
    }

    private setupSidebar() {
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        sidebarToggle?.addEventListener('click', () => {
            sidebar?.classList.remove('-translate-x-full');
            overlay?.classList.remove('hidden');
        });

        overlay?.addEventListener('click', () => {
            sidebar?.classList.add('-translate-x-full');
            overlay?.classList.add('hidden');
        });

        // Logout functionality
        document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userSettings');
            window.location.href = '/dashboard';
        });
    }

    private async loadUserProfile() {
        try {
            const response = await authFetch('/api/profile/me');
            if (!response.ok) {
                throw new Error('Failed to load profile');
            }
            const data = await response.json();
            // /api/profile/me returns the user data directly, not wrapped in data.user
            if (data) {
                this.displayUserProfile(data);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    private displayUserProfile(user: UserProfile) {
        // Update username
        const usernameEl = document.getElementById('username-display');
        if (usernameEl) {
            usernameEl.textContent = user.username;
        }

        // Update email
        const emailEl = document.getElementById('email-display');
        if (emailEl) {
            emailEl.textContent = user.email;
        }

        // Update account type badge
        const accountTypeBadge = document.getElementById('account-type-badge');
        if (accountTypeBadge) {
            const provider = user.auth_provider || 'manual';
            accountTypeBadge.textContent = provider === 'manual' ? 'Local Account' : 
                provider === 'google' ? 'Google Account' : 'OAuth Account';
            
            accountTypeBadge.className = `px-3 py-1 rounded-full text-xs font-medium ${
                provider === 'manual' 
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500' 
                    : 'bg-green-600/20 text-green-400 border border-green-500'
            }`;
        }
    }

    private async loadSettings() {
        // Load settings from localStorage (client-side storage)
        const savedSettings = localStorage.getItem('userSettings');
        if (savedSettings) {
            try {
                this.userSettings = { ...this.userSettings, ...JSON.parse(savedSettings) };
            } catch (error) {
                console.error('Error parsing saved settings:', error);
            }
        }

        // Update UI with loaded settings
        this.updateSettingsUI();
    }

    private updateSettingsUI() {
        // AI Difficulty
        const aiDifficultySelect = document.getElementById('ai-difficulty') as HTMLSelectElement;
        if (aiDifficultySelect) {
            aiDifficultySelect.value = this.userSettings.aiDifficulty;
        }

        // Game Speed
        const gameSpeedSelect = document.getElementById('game-speed') as HTMLSelectElement;
        if (gameSpeedSelect) {
            gameSpeedSelect.value = this.userSettings.gameSpeed;
        }

        // Sound Effects
        const soundCheckbox = document.getElementById('sound-enabled') as HTMLInputElement;
        if (soundCheckbox) {
            soundCheckbox.checked = this.userSettings.soundEnabled;
        }

        // Profile Visibility
        const profileVisibilitySelect = document.getElementById('profile-visibility') as HTMLSelectElement;
        if (profileVisibilitySelect) {
            profileVisibilitySelect.value = this.userSettings.profileVisibility;
        }

        // Show Online Status
        const showOnlineCheckbox = document.getElementById('show-online') as HTMLInputElement;
        if (showOnlineCheckbox) {
            showOnlineCheckbox.checked = this.userSettings.showOnlineStatus;
        }
    }

    private setupEventListeners() {
        // Save Settings Button
        document.getElementById('save-settings-btn')?.addEventListener('click', () => {
            this.saveSettings();
        });

        // Reset Stats Button
        document.getElementById('reset-stats-btn')?.addEventListener('click', () => {
            this.showResetStatsConfirmation();
        });

        // Delete Account Button
        document.getElementById('delete-account-btn')?.addEventListener('click', () => {
            this.showDeleteAccountConfirmation();
        });

        // Real-time setting updates
        document.getElementById('ai-difficulty')?.addEventListener('change', (e) => {
            this.userSettings.aiDifficulty = (e.target as HTMLSelectElement).value as any;
        });

        document.getElementById('game-speed')?.addEventListener('change', (e) => {
            this.userSettings.gameSpeed = (e.target as HTMLSelectElement).value as any;
        });

        document.getElementById('sound-enabled')?.addEventListener('change', (e) => {
            this.userSettings.soundEnabled = (e.target as HTMLInputElement).checked;
        });

        document.getElementById('profile-visibility')?.addEventListener('change', (e) => {
            this.userSettings.profileVisibility = (e.target as HTMLSelectElement).value as any;
        });

        document.getElementById('show-online')?.addEventListener('change', (e) => {
            this.userSettings.showOnlineStatus = (e.target as HTMLInputElement).checked;
        });
    }

    private async saveSettings() {
        const button = document.getElementById('save-settings-btn') as HTMLButtonElement;
        const originalText = button.textContent;

        try {
            // Update button state
            button.disabled = true;
            button.textContent = 'Saving...';
            button.classList.add('opacity-50');

            // Save settings to localStorage
            localStorage.setItem('userSettings', JSON.stringify(this.userSettings));

            // Show success message
            this.showNotification('Settings saved successfully!', 'success');

            // Reset button
            button.textContent = 'Saved!';
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
                button.classList.remove('opacity-50');
            }, 2000);

        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Failed to save settings. Please try again.', 'error');
            
            // Reset button
            button.textContent = originalText;
            button.disabled = false;
            button.classList.remove('opacity-50');
        }
    }

    private showResetStatsConfirmation() {
        if (confirm('Are you sure you want to reset all your game statistics? This cannot be undone.')) {
            this.resetStats();
        }
    }

    private async resetStats() {
        try {
            const response = await authFetch('/api/profile/reset-stats', {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error('Failed to reset stats');
            }
            this.showNotification('Game statistics have been reset.', 'success');
        } catch (error) {
            console.error('Error resetting stats:', error);
            this.showNotification('Failed to reset statistics. Please try again.', 'error');
        }
    }

    private showDeleteAccountConfirmation() {
        const confirmed = prompt(
            'Are you sure you want to delete your account? This will permanently delete all your data and cannot be undone.\\n\\nType "DELETE" to confirm:'
        );
        
        if (confirmed === 'DELETE') {
            this.deleteAccount();
        }
    }

    private async deleteAccount() {
        try {
            const response = await authFetch('/api/profile/delete-account', {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete account');
            }
            
            // Clear all local storage
            localStorage.clear();
            
            alert('Your account has been deleted.');
            window.location.href = '/dashboard';
        } catch (error) {
            console.error('Error deleting account:', error);
            this.showNotification('Failed to delete account. Please try again.', 'error');
        }
    }

    private showNotification(message: string, type: 'success' | 'error') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all ${
            type === 'success' 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Public method to get current settings (for use by game classes)
    public static getSettings(): UserSettings {
        const savedSettings = localStorage.getItem('userSettings');
        const defaultSettings: UserSettings = {
            aiDifficulty: 'medium',
            gameSpeed: 'normal',
            soundEnabled: true,
            profileVisibility: 'public',
            showOnlineStatus: true
        };

        if (savedSettings) {
            try {
                return { ...defaultSettings, ...JSON.parse(savedSettings) };
            } catch (error) {
                console.error('Error parsing saved settings:', error);
                return defaultSettings;
            }
        }

        return defaultSettings;
    }
}

// Initialize settings manager
new SettingsManager();