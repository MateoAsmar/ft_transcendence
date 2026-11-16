import { getScoreboardMarkup, type ScoreboardOptions } from './scoreboard';

export interface GameArenaOptions {
  /**
   * Optional additional markup to append inside the arena container.
   * Consumers can inject mode-specific overlays if needed.
   */
  extraOverlays?: string;
  
  /**
   * Scoreboard options (timer, badge, etc.)
   */
  scoreboardOptions?: ScoreboardOptions;
}

/**
 * Return the shared game arena markup used across every game mode.
 * The structure mirrors the online arena so all engines (local, AI, remote)
 * can rely on the same element IDs and layout.
 * 
 * The scoreboard is positioned ABOVE the canvas for better visibility.
 */
export function getGameArenaMarkup(options: GameArenaOptions = {}): string {
  const { extraOverlays = '', scoreboardOptions = {} } = options;

  return `
    <!-- Scoreboard positioned above the canvas -->
    ${getScoreboardMarkup(scoreboardOptions)}
    
    <div id="gameContainer" class="relative w-full game-container-fixed">
      <div class="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-60 blur-lg"></div>

      <canvas
        id="gameCanvas"
        width="1200"
        height="700"
        class="relative bg-black rounded-2xl border border-gray-800 shadow-lg w-full h-auto"
      ></canvas>

      <div id="waitingScreen" class="absolute inset-0 bg-black/80 rounded-2xl z-20" style="display: none;">
        <div class="text-center space-y-3" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
          <div class="text-cyan-300 text-2xl font-semibold">Waiting for opponent…</div>
          <div class="text-gray-400">Share this code:</div>
          <div id="roomCodeDisplay" class="text-2xl tracking-[0.35em] font-mono text-cyan-200"></div>
        </div>
      </div>

      <div id="searchingScreen" class="absolute inset-0 bg-black/80 rounded-2xl z-20" style="display: none;">
        <div class="text-center space-y-3" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
          <div class="text-cyan-300 text-2xl font-semibold animate-pulse">Searching for opponent…</div>
          <div class="text-gray-400">Please wait</div>
        </div>
      </div>

      <div id="authPrompt" class="absolute inset-0 bg-black/80 rounded-2xl z-20" style="display: none;">
        <div class="bg-gray-900/90 border border-cyan-500/40 rounded-xl p-8 text-center max-w-sm space-y-4" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
          <h3 class="text-xl font-semibold text-cyan-300">Sign in to play online</h3>
          <p class="text-sm text-gray-400">Online matches require an account so we can keep your progress and stats.</p>
          <a data-link href="/login" class="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors">Go to Login</a>
        </div>
      </div>

      <div id="roomScreen" class="absolute inset-0 bg-black/85 rounded-2xl z-20 flex items-center justify-center p-6" style="display: none;">
        <div class="bg-gray-900/90 border border-purple-400/40 rounded-xl p-8 text-center max-w-md w-full mx-auto space-y-5">
          <div>
            <h3 class="text-2xl font-semibold text-purple-300">Match Lobby</h3>
            <p class="text-sm text-gray-400 mt-2">Both players must press ready before the game begins.</p>
          </div>
          <div id="playersInfo" class="space-y-3 text-base text-gray-300"></div>
          <button id="readyBtn"
            class="w-full px-6 py-3 bg-purple-600 hover:bg-purple-500 border border-purple-400 rounded-lg text-white text-base font-semibold transition-all transform hover:scale-105 shadow-lg">
            Ready to Play
          </button>
        </div>
      </div>

      <div id="gameOverModal" class="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/90 p-6" style="display: none;">
        <div class="bg-gray-900 border border-cyan-400/40 rounded-xl p-8 text-center space-y-4 max-w-sm w-full">
          <div id="winnerIcon" class="w-20 h-20 mx-auto mb-1 border-2 border-cyan-400 rounded-full flex items-center justify-center text-2xl">??</div>
          <h3 id="gameOverText" class="text-3xl font-semibold text-cyan-300">Game Over</h3>
          <p id="gameOverResult" class="text-gray-300"></p>
          <div class="flex flex-col gap-3">
            <button id="playAgainBtn" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-semibold transition-colors">Play Again</button>
            <button id="backToMenuBtn" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-200 text-sm transition-colors">Back to Menu</button>
          </div>
        </div>
      </div>

      ${extraOverlays}
    </div>
  `;
}
