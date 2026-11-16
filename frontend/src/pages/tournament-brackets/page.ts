import { renderBackground, renderNavbar, renderBackButton } from '../../shared/ui/layout';

export async function render(container: HTMLElement) {
	const { TournamentBracketsManager } = await import('./tournament-brackets');
	
	container.innerHTML = `
		<div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-3 xs:p-4 sm:p-5 md:p-6">
			<!-- Header -->
			<div class="max-w-7xl mx-auto mb-6 xs:mb-8">
				<div class="flex items-center justify-between flex-wrap gap-3 xs:gap-4">
					<div>
						<h1 class="text-3xl xs:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
							🏆 Tournament Brackets
						</h1>
						<p id="tournamentName" class="text-gray-400 text-sm xs:text-base mt-1 xs:mt-2">Loading tournament...</p>
					</div>
					<div class="flex gap-2">
						<button id="refreshBtn" class="px-3 xs:px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm xs:text-base rounded-lg transition">
							🔄 Refresh
						</button>
						<a data-link href="/tournament" class="px-3 xs:px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm xs:text-base rounded-lg transition">
							← Back
						</a>
					</div>
				</div>
			</div>

			<!-- Tournament Status -->
			<div class="max-w-7xl mx-auto mb-4 xs:mb-6">
				<div class="bg-gray-800/50 backdrop-blur border border-purple-500/30 rounded-xl p-3 xs:p-4">
					<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 xs:gap-4 text-center">
						<div>
							<p class="text-gray-400 text-xs xs:text-sm">Status</p>
							<p id="tournamentStatus" class="text-base xs:text-lg font-bold text-white">-</p>
						</div>
						<div>
							<p class="text-gray-400 text-xs xs:text-sm">Current Round</p>
							<p id="currentRound" class="text-base xs:text-lg font-bold text-cyan-400">-</p>
						</div>
						<div>
							<p class="text-gray-400 text-xs xs:text-sm">Total Players</p>
							<p id="totalPlayers" class="text-base xs:text-lg font-bold text-white">-</p>
						</div>
						<div>
							<p class="text-gray-400 text-xs xs:text-sm">Champion</p>
							<p id="champion" class="text-base xs:text-lg font-bold text-yellow-400">TBD</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Brackets Display -->
			<div class="max-w-7xl mx-auto">
				<div id="bracketsContainer" class="bg-gray-800/30 backdrop-blur border border-gray-700 rounded-xl p-4 xs:p-5 md:p-6 overflow-x-auto">
					<p class="text-gray-500 text-center py-6 xs:py-8">Loading brackets...</p>
				</div>
			</div>
      </div>

      <div class="fixed bottom-4 right-4 px-4 py-2 bg-gray-900/90 rounded-lg border border-gray-700 flex items-center gap-2 backdrop-blur-sm">
        <div id="connectionIndicator" class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
        <span id="connectionStatus" class="text-sm text-gray-300">Connecting...</span>
      </div>
    </div>
  `;

  new TournamentBracketsManager();
}

export function cleanup() {
  console.log('Tournament brackets page cleanup');
}
