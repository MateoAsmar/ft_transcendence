export async function render(container: HTMLElement) {
	const { TournamentLobbyManager } = await import('./tournament-lobby');
	
	container.innerHTML = `
		<div class="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-3 xs:p-4 sm:p-5 md:p-6">
			<!-- Header -->
			<div class="max-w-6xl mx-auto mb-6 xs:mb-8">
				<div class="flex items-center justify-between flex-wrap gap-3 xs:gap-4">
					<div>
						<h1 class="text-3xl xs:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
							🎮 Tournament Lobby
						</h1>
						<p class="text-gray-400 text-sm xs:text-base mt-1 xs:mt-2">Waiting for players...</p>
					</div>
					<button id="leaveLobbyBtn" class="px-3 xs:px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm xs:text-base rounded-lg transition">
						Leave Lobby
					</button>
				</div>
			</div>

			<!-- Tournament Info -->
			<div class="max-w-6xl mx-auto mb-4 xs:mb-6">
				<div class="bg-gray-800/50 backdrop-blur border border-blue-500/30 rounded-xl p-4 xs:p-5 md:p-6">
					<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 xs:gap-4">
						<div class="text-center">
							<p class="text-gray-400 text-xs xs:text-sm">Tournament Name</p>
							<p id="tournamentName" class="text-base xs:text-lg md:text-xl font-bold text-white">Loading...</p>
						</div>
						<div class="text-center">
							<p class="text-gray-400 text-xs xs:text-sm">Join Code</p>
							<p id="joinCode" class="text-xl xs:text-2xl font-bold text-cyan-400 tracking-wider">------</p>
						</div>
						<div class="text-center">
							<p class="text-gray-400 text-xs xs:text-sm">Players</p>
							<p id="playerCount" class="text-base xs:text-lg md:text-xl font-bold text-white">0/0</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Players Grid -->
			<div class="max-w-6xl mx-auto mb-4 xs:mb-6">
				<h2 class="text-xl xs:text-2xl md:text-3xl font-bold text-white mb-3 xs:mb-4">Players</h2>
				<div id="playersGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 xs:gap-4">
					<!-- Players will be rendered here -->
				</div>
			</div>

			<!-- Start Button (Creator Only) -->
			<div class="max-w-6xl mx-auto text-center">
				<button
					id="startTournamentBtn"
					class="hidden px-6 xs:px-8 py-3 xs:py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-base xs:text-lg rounded-lg transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
					disabled
				>
					Start Tournament
				</button>
				<p id="startBtnMessage" class="hidden mt-2 text-gray-400 text-xs xs:text-sm"></p>
			</div>

            <section>
              <div class="flex items-center justify-between mb-4">
                <button
                  id="startTournamentBtn"
                  class="hidden px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-600 text-white font-semibold rounded-lg transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled
                >
                  Start Tournament
                </button>
              </div>
              <p id="startBtnMessage" class="hidden mb-4 text-sm text-gray-400"></p>
              <div id="playersGrid" class="grid grid-cols-2 md:grid-cols-4 gap-4"></div>
            </section>
          </div>
        </main>
      </div>

      <div class="fixed bottom-4 right-4 px-4 py-2 bg-gray-900/90 rounded-lg border border-gray-700 flex items-center gap-2 backdrop-blur-sm">
        <div id="connectionIndicator" class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
        <span id="connectionStatus" class="text-sm text-gray-300">Connecting...</span>
      </div>
    </div>
  `;

  new TournamentLobbyManager();
}

export function cleanup() {
  console.log('Tournament lobby page cleanup');
}
