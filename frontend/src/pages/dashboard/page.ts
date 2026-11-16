import { validateAuth, getCachedUser } from '../../shared/auth';
import { renderBackground, renderNavbar } from '../../shared/ui/layout';
import { authFetch } from '../../shared/auth';

export async function render(container: HTMLElement) {
  // Handle token returned from OAuth or login redirects
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token');
  if (token) {
    url.searchParams.delete('token');
    history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden text-white">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col">
        ${renderNavbar({
          title: 'Dashboard',
          subtitle: 'Jump back into matches, check your stats, and manage every part of your Pong experience.',
          rightContent: `
            <span id="username-display" class="text-gray-200 text-xs xs:text-sm sm:text-base font-medium"></span>
          `,
        })}

        <main class="flex-1 p-3 xs:p-4 sm:p-6 pb-8 overflow-y-auto">
          <div class="max-w-5xl mx-auto pb-6 space-y-8">
            <div class="text-center space-y-3">
              <h2 class="text-4xl md:text-5xl font-bold text-white">Welcome to Pong</h2>
              <p class="text-gray-300 text-base md:text-lg max-w-2xl mx-auto">Experience the classic game with modern features</p>
            </div>

            <section class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <!-- Play Card -->
              <div id="play-card" class="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur border border-purple-500/50 rounded-xl p-8 text-center cursor-pointer card-hover group">
                <div class="w-24 h-24 bg-purple-500/30 border-2 border-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform">
                  <span class="text-5xl">🎮</span>
                </div>
                <h3 class="text-3xl font-bold text-white mb-3">Play</h3>
                <p class="text-gray-300 text-sm">Choose your game mode</p>
              </div>

              <!-- Statistics Card -->
              <a data-link href="/stats" class="block">
                <div class="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 backdrop-blur border border-cyan-500/50 rounded-xl p-8 text-center card-hover group">
                  <div class="w-24 h-24 bg-cyan-500/30 border-2 border-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform">
                    <span class="text-5xl">📊</span>
                  </div>
                  <h3 class="text-3xl font-bold text-white mb-3">Statistics</h3>
                  <p class="text-gray-300 text-sm">View your stats and leaderboard</p>
                </div>
              </a>

              <!-- Friends Card -->
              <a data-link href="/friends" class="block">
                <div class="bg-gradient-to-br from-pink-900/40 to-red-900/40 backdrop-blur border border-pink-500/50 rounded-xl p-8 text-center card-hover group">
                  <div class="w-24 h-24 bg-pink-500/30 border-2 border-pink-400 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform">
                    <span class="text-5xl">👥</span>
                  </div>
                  <h3 class="text-3xl font-bold text-white mb-3">Friends</h3>
                  <p class="text-gray-300 text-sm">Manage friends and invitations</p>
                </div>
              </a>

              <!-- Profile Card -->
              <a data-link href="/profile" class="block">
                <div class="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 backdrop-blur border border-blue-500/50 rounded-xl p-8 text-center card-hover group">
                  <div class="w-24 h-24 bg-blue-500/30 border-2 border-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform">
                    <span class="text-5xl">👤</span>
                  </div>
                  <h3 class="text-3xl font-bold text-white mb-3">Profile</h3>
                  <p class="text-gray-300 text-sm">View and edit your profile</p>
                </div>
              </a>
            </section>

            <!-- Settings Link (smaller, bottom) -->
            <div class="max-w-4xl mx-auto">
              <a data-link href="/settings" class="block">
                <div class="bg-gray-900/60 backdrop-blur border border-gray-700 rounded-lg p-4 text-center card-hover group flex items-center justify-center gap-3">
                  <div class="w-10 h-10 bg-indigo-500/20 border border-indigo-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span class="text-xl">⚙️</span>
                  </div>
                  <div class="text-left">
                    <h3 class="text-lg font-bold text-white">Settings</h3>
                    <p class="text-gray-400 text-xs">Privacy & data management</p>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </main>

        <!-- Play Mode Selection Modal -->
        <div id="play-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm invisible">
          <div class="bg-gray-900 border border-purple-500/50 rounded-xl shadow-2xl max-w-2xl w-full mx-4 p-8">
            <h3 class="text-3xl font-bold text-purple-400 mb-6 text-center">Choose Game Mode</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <a data-link href="/game-online" class="block">
                <div class="bg-gray-800/60 border border-green-500/50 rounded-lg p-6 text-center card-hover group">
                  <div class="w-16 h-16 bg-green-500/20 border border-green-500 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <span class="text-3xl">🌐</span>
                  </div>
                  <h4 class="text-xl font-bold text-white mb-2">Online</h4>
                  <p class="text-gray-400 text-sm">Real-time multiplayer</p>
                </div>
              </a>
              <a data-link href="/game" class="block">
                <div class="bg-gray-800/60 border border-purple-500/50 rounded-lg p-6 text-center card-hover group">
                  <div class="w-16 h-16 bg-purple-500/20 border border-purple-500 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <span class="text-3xl">🎮</span>
                  </div>
                  <h4 class="text-xl font-bold text-white mb-2">Local</h4>
                  <p class="text-gray-400 text-sm">Same device, two players</p>
                </div>
              </a>
              <a data-link href="/game-ai" class="block">
                <div class="bg-gray-800/60 border border-orange-500/50 rounded-lg p-6 text-center card-hover group">
                  <div class="w-16 h-16 bg-orange-500/20 border border-orange-500 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <span class="text-3xl">🤖</span>
                  </div>
                  <h4 class="text-xl font-bold text-white mb-2">AI</h4>
                  <p class="text-gray-400 text-sm">Challenge the AI</p>
                </div>
              </a>
              <a data-link href="/tournament" class="block">
                <div class="bg-gray-800/60 border border-yellow-500/50 rounded-lg p-6 text-center card-hover group">
                  <div class="w-16 h-16 bg-yellow-500/20 border border-yellow-500 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <span class="text-3xl">🏆</span>
                  </div>
                  <h4 class="text-xl font-bold text-white mb-2">Tournament</h4>
                  <p class="text-gray-400 text-sm">Bracket competition</p>
                </div>
              </a>
            </div>
            <button id="close-modal" class="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire play modal
  const playCard = container.querySelector('#play-card');
  const playModal = container.querySelector('#play-modal');
  const closeModalBtn = container.querySelector('#close-modal');

  playCard?.addEventListener('click', () => {
    playModal?.classList.remove('invisible');
  });

  closeModalBtn?.addEventListener('click', () => {
    playModal?.classList.add('hidden');
  });

  // Close modal on background click
  playModal?.addEventListener('click', (e) => {
    if (e.target === playModal) {
      playModal.classList.add('hidden');
    }
  });

  // Load user info if authenticated (token or cookie)
  if (getCachedUser() !== null || (await validateAuth() !== null)) {
    try {
      const meRes = await authFetch('/api/profile/me');
      if (meRes.ok) {
        const data = await meRes.json();
        const username = data.display_name || data.username || null;
        const displayText = username ? `Welcome, ${username}` : 'Welcome';
        const nameEl = container.querySelector('#username-display');
        if (nameEl) nameEl.textContent = displayText;
      }
    } catch (e) {
      // ignore
    }
  }
}
