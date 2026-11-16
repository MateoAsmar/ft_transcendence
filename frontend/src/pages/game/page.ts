import { getGameArenaMarkup } from "../../shared/game-arena";
import {
  renderBackground,
  renderNavbar,
  renderBackButton,
  renderSidebarShell,
} from "../../shared/ui/layout";

// Game (local) SPA wrapper: mounts existing game.ts UI into SPA container
export async function render(container: HTMLElement) {
  container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col">
        ${renderNavbar({
          title: "Local Game",
          subtitle:
            "Play head-to-head on one machine with classic controls and instant restarts.",
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
                  <h2 class="text-2xl font-bold text-cyan-400 mb-2">Match Controls</h2>
                  <p class="text-sm text-gray-400">Adjust settings and jump into a local match.</p>
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

                <div class="bg-gray-800/60 rounded-lg p-4 border border-gray-700 space-y-3">
                  <div>
                    <h3 class="text-sm font-semibold text-gray-400 mb-2">STATUS</h3>
                    <div id="gameStatus" class="text-white text-sm">
                      Press START to begin the game
                    </div>
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
                    text: "🎮 Local Two-Player Game",
                    color: "purple",
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

  // Import and bootstrap the game explicitly to handle SPA late-load
  const mod = await import("./game.ts");
  if (mod.bootstrapPongGame) {
    mod.bootstrapPongGame();
  }
}
