// Tournament Play Page - Match gameplay using shared game arena
import { getGameArenaMarkup } from '../../shared/game-arena';
import { renderBackground, renderNavbar, renderBackButton } from '../../shared/ui/layout';

export async function render(container: HTMLElement) {
  const { TournamentPlayManager } = await import('./tournament-play');

  // Check if in spectate mode
  const params = new URLSearchParams(window.location.search);
  const isSpectator = params.get('spectate') === 'true';

  container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col">
        ${renderNavbar({
          title: isSpectator ? 'Spectating Tournament Match' : 'Tournament Match',
          subtitle: isSpectator 
            ? 'Watch the tournament match unfold in real-time as a spectator.' 
            : 'Compete in the tournament bracket — the winner advances to the next round.',
          rightContent: `
            <div class="flex items-center gap-3">
              ${isSpectator ? `
                <div class="px-3 py-1.5 bg-yellow-900/50 border border-yellow-500/50 rounded-lg">
                  <span class="text-yellow-300 font-semibold text-sm">👁️ SPECTATING</span>
                </div>
              ` : ''}
              <div id="connectionStatus" class="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
                <div id="connectionIndicator" class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                <span class="text-xs text-gray-300">Connecting...</span>
              </div>
              ${renderBackButton({ href: '/tournament/brackets?id=' + (params.get('tournamentId') || ''), label: 'Back to Brackets' })}
            </div>
          `,
        })}

        <main class="flex-1 p-6 flex flex-col items-center justify-center">
          ${getGameArenaMarkup({
            scoreboardOptions: {
              showTimer: true,
              badge: {
                text: isSpectator ? 'SPECTATING' : 'TOURNAMENT MATCH',
                color: isSpectator ? 'yellow' : 'purple',
              },
            },
            extraOverlays: `
              <!-- Tournament Waiting Overlay -->
              <div id="waitingOverlay" class="absolute inset-0 bg-black/90 rounded-2xl flex items-center justify-center z-30">
                <div class="text-center space-y-4">
                  <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400 mx-auto"></div>
                  <p class="text-xl text-cyan-300">${isSpectator ? 'Connecting to match...' : 'Connecting to match...'}</p>
                  <p id="waitingMessage" class="text-sm text-gray-400">${isSpectator ? 'Loading game state...' : 'Please wait'}</p>
                </div>
              </div>
            `,
          })}
        </main>
      </div>
    </div>
  `;

  new TournamentPlayManager();
}

export function cleanup() {
  console.log('Tournament play page cleanup');
}
