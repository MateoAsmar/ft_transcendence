export async function render(container: HTMLElement) {
	const { TournamentSetupManager } = await import('./tournament-setup');
	
	container.innerHTML = `
		<div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-3 xs:p-4 sm:p-5 md:p-6">
			<!-- Header -->
			<div class="max-w-7xl mx-auto mb-6 xs:mb-8">
				<div class="flex items-center justify-between flex-wrap gap-3 xs:gap-4">
					<div>
						<h1 class="text-3xl xs:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
							🏆 Tournament Mode
						</h1>
						<p class="text-gray-400 text-sm xs:text-base mt-1 xs:mt-2">Create or join a tournament</p>
					</div>
					<a data-link href="/dashboard" class="px-3 xs:px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm xs:text-base rounded-lg transition">
						← Back to Dashboard
					</a>
				</div>
			</div>

			<!-- Main Content -->
			<div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 xs:gap-5 md:gap-6">
				<!-- Create Tournament Card -->
				<div class="bg-gray-800/50 backdrop-blur border border-purple-500/30 rounded-xl p-4 xs:p-5 md:p-6">
					<h2 class="text-xl xs:text-2xl font-bold text-cyan-400 mb-3 xs:mb-4">Create Tournament</h2>
					
					<form id="createTournamentForm" class="space-y-3 xs:space-y-4">
						<!-- Tournament Name -->
						<div>
							<label class="block text-xs xs:text-sm font-medium text-gray-300 mb-1 xs:mb-2">Tournament Name</label>
							<input
								type="text"
								id="tournamentName"
								placeholder="My Tournament"
								class="w-full px-3 xs:px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm xs:text-base focus:border-cyan-500 focus:outline-none"
								required
								maxlength="50"
							/>
						</div>

						<!-- Tournament Size -->
						<div>
							<label class="block text-xs xs:text-sm font-medium text-gray-300 mb-1 xs:mb-2">Number of Players</label>
							<select
								id="tournamentSize"
								class="w-full px-3 xs:px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm xs:text-base focus:border-cyan-500 focus:outline-none"
							>
								<option value="4">4 Players (2 rounds)</option>
								<option value="8">8 Players (3 rounds)</option>
								<option value="16">16 Players (4 rounds)</option>
							</select>
						</div>

						<!-- Match Type -->
						<div>
							<label class="block text-xs xs:text-sm font-medium text-gray-300 mb-1 xs:mb-2">Win Condition</label>
							<select
								id="matchType"
								class="w-full px-3 xs:px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm xs:text-base focus:border-cyan-500 focus:outline-none"
							>
								<option value="3">First to 3 points</option>
							</select>
						</div>

						<button
							type="submit"
							class="w-full px-4 xs:px-6 py-2.5 xs:py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-bold text-sm xs:text-base rounded-lg transition transform hover:scale-105"
						>
							Create Tournament
						</button>
					</form>
				</div>

				<!-- Join Tournament Card -->
				<div class="bg-gray-800/50 backdrop-blur border border-cyan-500/30 rounded-xl p-4 xs:p-5 md:p-6">
					<h2 class="text-xl xs:text-2xl font-bold text-purple-400 mb-3 xs:mb-4">Join Tournament</h2>

					<form id="joinTournamentForm" class="space-y-3 xs:space-y-4">
						<div>
							<label class="block text-xs xs:text-sm font-medium text-gray-300 mb-1 xs:mb-2">Join Code</label>
							<input
								type="text"
								id="joinCode"
								placeholder="Enter 6-digit code"
								class="w-full px-3 xs:px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-center text-xl xs:text-2xl tracking-widest uppercase focus:border-purple-500 focus:outline-none"
								required
								maxlength="6"
								pattern="[A-Za-z0-9]{6}"
							/>
						</div>

						<button
							type="submit"
							class="w-full px-4 xs:px-6 py-2.5 xs:py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-sm xs:text-base rounded-lg transition transform hover:scale-105"
						>
							Join Tournament
						</button>
					</form>

					<div class="mt-4 xs:mt-6 pt-4 xs:pt-6 border-t border-gray-700">
						<h3 class="text-base xs:text-lg font-semibold text-gray-300 mb-2 xs:mb-3">Active Tournaments</h3>
						<div id="activeTournamentsList" class="space-y-2 max-h-64 overflow-y-auto">
							<p class="text-gray-500 text-center text-sm xs:text-base py-3 xs:py-4">Loading...</p>
						</div>
					</div>
				</div>
			</div>
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

  new TournamentSetupManager();
}

export function cleanup() {
  console.log('Tournament setup page cleanup');
}
