import { getGameArenaMarkup } from "../../shared/game-arena";
import {
  renderBackground,
  renderNavbar,
  renderBackButton,
  renderSidebarShell,
} from "../../shared/ui/layout";

// AI game SPA wrapper: mounts existing ai.ts into SPA container
export async function render(container: HTMLElement) {
  container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col">
        ${renderNavbar({
          title: "Play vs AI",
          subtitle:
            "Select a difficulty level and take on our adaptive opponent.",
          rightContent: renderBackButton({
            href: "/dashboard",
            label: "Back to Dashboard",
          }),
        })}

        <div class="flex flex-1 flex-col gap-6 xl:flex-row xl:gap-0 overflow-hidden">
          ${renderSidebarShell({
            content: `
              <div class="p-6 space-y-6">
                <div>
                  <h2 class="text-2xl font-bold text-cyan-400 mb-2">Match Setup</h2>
                  <p class="text-sm text-gray-400">Choose your difficulty and control scheme.</p>
                </div>

                <div>
                  <h3 class="text-lg font-semibold text-white mb-3">Select Difficulty</h3>
                  <div class="space-y-2" id="difficulty-selector">
                    <button data-difficulty="easy"
                      class="difficulty-btn w-full px-6 py-3 bg-green-600/80 hover:bg-green-600 border border-green-400 rounded-lg text-white font-bold transition-all shadow-lg hover:shadow-green-500/50">
                      EASY
                    </button>
                    <button data-difficulty="medium"
                      class="difficulty-btn w-full px-6 py-3 bg-yellow-600/80 hover:bg-yellow-600 border border-yellow-400 rounded-lg text-white font-bold transition-all shadow-lg hover:shadow-yellow-500/50">
                      MEDIUM
                    </button>
                    <button data-difficulty="hard"
                      class="difficulty-btn w-full px-6 py-3 bg-red-600/80 hover:bg-red-600 border border-red-400 rounded-lg text-white font-bold transition-all shadow-lg hover:shadow-red-500/50">
                      HARD
                    </button>
                  </div>
                </div>

                <div class="space-y-3">
                  <h3 class="text-lg font-semibold text-white">Game Controls</h3>
                  <button id="startBtn"
                    class="w-full px-6 py-3 bg-cyan-600/80 hover:bg-cyan-600 border border-cyan-400 rounded-lg text-white font-bold transition-all shadow-lg hover:shadow-cyan-500/50">
                    START GAME
                  </button>
                  <button id="exitBtn"
                    class="w-full px-6 py-3 bg-red-600/80 hover:bg-red-600 border border-red-400 rounded-lg text-white font-bold transition-all shadow-lg hover:shadow-red-500/50"
                    style="display: none;">
                    EXIT MATCH
                  </button>
                </div>

                <div class="bg-gray-800/60 rounded-lg p-4 border border-gray-700 space-y-2">
                  <div>
                    <h3 class="text-sm font-semibold text-gray-400 mb-2">STATUS</h3>
                    <div id="gameStatus" class="text-white text-sm mb-2">
                      Select difficulty and press START
                    </div>
                  </div>
                  <div id="difficultyDisplay" class="text-cyan-400 text-sm">
                    Difficulty: <span id="currentDifficulty">Medium</span>
                  </div>
                </div>
              </div>
            `,
          })}

          <main class="flex-1 p-6">
            <div class="h-full w-full flex flex-col items-center justify-start">
              ${getGameArenaMarkup({
                scoreboardOptions: {
                  badge: {
                    text: "🤖 Game vs AI",
                    color: "cyan",
                  },
                },
              })}
            </div>
          </main>
        </div>
      </div>
    </div>

    <div
      id="connectionStatusContainer"
      class="fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-lg border border-purple-500/60 bg-gray-900/90 px-4 py-2 backdrop-blur-sm"
    >
      <div id="connectionIndicator" class="h-2 w-2 rounded-full bg-purple-400"></div>
      <span id="connectionStatus" class="text-sm font-medium text-purple-300">Ready to play</span>
    </div>
  `;

  const player1NameLabel = container.querySelector("#player1Name");
  if (player1NameLabel) player1NameLabel.textContent = "You";
  const player2NameLabel = container.querySelector("#player2Name");
  if (player2NameLabel) player2NameLabel.textContent = "AI";

  // Add difficulty selector logic
  const difficultyButtons = container.querySelectorAll(".difficulty-btn");
  const currentDifficultySpan = container.querySelector("#currentDifficulty");

  difficultyButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const difficulty = target.getAttribute("data-difficulty") || "medium";

      // Update visual state
      difficultyButtons.forEach((b) =>
        b.classList.remove("ring-4", "ring-white")
      );
      target.classList.add("ring-4", "ring-white");

      // Update display
      if (currentDifficultySpan) {
        currentDifficultySpan.textContent =
          difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
      }

      // Store for game logic
      (window as any).aiDifficulty = difficulty;
    });
  });

  // Set default difficulty
  const mediumBtn = container.querySelector('[data-difficulty="medium"]');
  if (mediumBtn) {
    mediumBtn.classList.add("ring-4", "ring-white");
  }
  (window as any).aiDifficulty = "medium";

  const mod = await import("./game-ai.ts");
  if (mod.bootstrapAIGame) mod.bootstrapAIGame();
}
