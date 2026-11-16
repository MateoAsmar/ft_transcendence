// Online game SPA wrapper: mounts existing game-online.ts UI into SPA container
import { getGameArenaMarkup } from '../../shared/game-arena';
import { renderBackground, renderNavbar, renderBackButton, renderSidebarShell } from '../../shared/ui/layout';

export async function render(container: HTMLElement) {
  container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col">
        ${renderNavbar({
          title: 'Online Game',
          subtitle: 'Host, invite, or join ongoing games instantly.',
          rightContent: renderBackButton({ href: '/dashboard', label: 'Back to Dashboard' }),
        })}

        <div class="flex flex-1 flex-col gap-6 xl:flex-row xl:gap-0 overflow-hidden">
          ${renderSidebarShell({
            content: `
              <div class="p-6 space-y-5">
                <section class="bg-gray-800/70 border border-gray-700 rounded-xl p-5 space-y-4">
                  <div>
                    <h3 class="text-lg font-semibold text-white">Quick Match</h3>
                    <p class="text-xs text-gray-400 mt-1">Find a random opponent and play immediately.</p>
                  </div>
                  <div class="flex gap-3">
                    <button id="findGameBtn" class="flex-1 px-4 py-2 bg-cyan-600/80 hover:bg-cyan-600 border border-cyan-400 rounded-lg text-white text-sm font-semibold transition-all">Find Opponent</button>
                    <button id="cancelSearchBtn" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-gray-200 text-sm transition-all">Cancel</button>
                  </div>
                  <p id="gameStatus" class="text-xs text-gray-500">Click "Find Opponent" to start matchmaking.</p>
                </section>

                <section class="bg-gray-800/70 border border-gray-700 rounded-xl p-5 space-y-4">
                  <div>
                    <h3 class="text-lg font-semibold text-white">Create & Share</h3>
                    <p class="text-xs text-gray-400 mt-1">Generate a join code and invite anyone.</p>
                  </div>
                  <button id="createPrivateBtn" class="w-full px-4 py-2 bg-purple-600/80 hover:bg-purple-600 border border-purple-400 rounded-lg text-white text-sm font-semibold transition-all">Generate Join Code</button>
                  <div id="active-room-card" class="hidden rounded-lg border border-purple-400/40 bg-purple-500/10 px-4 py-3 space-y-2">
                    <div class="text-xs text-gray-400 uppercase tracking-wide">Your join code</div>
                    <div id="roomCodeText" class="text-2xl font-semibold text-purple-200 tracking-[0.3em]">------</div>
                    <button id="copyRoomCodeBtn" class="w-full px-3 py-2 bg-purple-600/60 hover:bg-purple-600 rounded text-white text-xs font-semibold transition-colors">Copy Code</button>
                  </div>
                </section>

                <section class="bg-gray-800/70 border border-gray-700 rounded-xl p-5 space-y-4">
                  <div>
                    <h3 class="text-lg font-semibold text-white">Join by Code</h3>
                    <p class="text-xs text-gray-400 mt-1">Enter a code you received to join a lobby instantly.</p>
                  </div>
                  <div class="flex gap-3">
                    <input id="roomCodeInput" type="text" maxlength="8" placeholder="ABC123" class="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono uppercase focus:outline-none focus:border-cyan-400" />
                    <button id="joinByCodeBtn" class="px-4 py-2 bg-pink-600/80 hover:bg-pink-600 border border-pink-400 rounded-lg text-white text-sm font-semibold transition-all">Join</button>
                  </div>
                </section>

                <section class="bg-gray-800/70 border border-gray-700 rounded-xl p-5 space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold text-white">Invitations</h3>
                    <span class="text-xs text-gray-500">Friends & teammates</span>
                  </div>
                  <div id="game-invite-empty" class="text-sm text-gray-500">No invitations right now.</div>
                  <div id="game-invite-list" class="space-y-3"></div>
                </section>

                <section class="bg-gray-800/70 border border-gray-700 rounded-xl p-5 space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold text-white">Suggested Rooms</h3>
                    <button id="refreshRoomsBtn" class="px-3 py-1 text-xs border border-gray-600 rounded-lg text-gray-300 hover:border-cyan-400 hover:text-cyan-300 transition-colors">Refresh</button>
                  </div>
                  <div id="suggested-games-empty" class="text-sm text-gray-500">No public rooms are waiting. Create one above!</div>
                  <div id="suggested-games-list" class="space-y-3"></div>
                </section>
              </div>
            `,
          })}

          <main class="flex-1 p-6">
            <div class="h-full w-full flex flex-col items-center justify-start">
              ${getGameArenaMarkup({
                scoreboardOptions: {
                  showTimer: true,
                  badge: {
                    text: '🌐 Online Match',
                    color: 'cyan'
                  }
                }
              })}
            </div>
          </main>
        </div>
      </div>
    </div>

    <div
      id="connectionStatusContainer"
      class="fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/90 px-4 py-2 backdrop-blur-sm"
    >
      <div id="connectionIndicator" class="h-2 w-2 rounded-full bg-yellow-400 animate-pulse"></div>
      <span id="connectionStatus" class="text-sm text-gray-300">Connecting...</span>
    </div>
  `;
  await import('./game-online.ts');
}
