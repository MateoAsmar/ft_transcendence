import { authFetch } from "../../shared/auth";
import { getCachedUser } from "../../shared/auth";
import {
  renderBackground,
  renderNavbar,
  renderBackButton,
} from "../../shared/ui/layout";

export async function render(container: HTMLElement) {
  container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden text-white">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col">
        ${renderNavbar({
          title: "Leaderboard",
          subtitle: "Track top players across the arena",
          rightContent: renderBackButton({
            href: "/dashboard",
            label: "Back to Dashboard",
          }),
        })}

        <main class="flex-1 p-3 xs:p-4 sm:p-6">
          <div class="max-w-4xl mx-auto space-y-6">
            ${
              !getCachedUser() !== null
                ? `<div class="p-3 border border-yellow-600/60 bg-yellow-900/30 rounded text-yellow-200 text-sm">Sign in to see your personalized ranking.</div>`
                : ""
            }
            <div id="leaderboard-content" class="space-y-4"></div>
          </div>
        </main>
      </div>
    </div>
  `;

  try {
    const res = await authFetch("/leaderboard");
    if (!res.ok) throw new Error("Failed to load leaderboard");
    const data = await res.json();
    const list = (data.leaderboard || []) as any[];
    const userRanking = data.userRanking;

    const content = container.querySelector("#leaderboard-content")!;
    content.innerHTML = `
      ${
        userRanking
          ? `<div class="leaderboard-card"><div class="text-sm text-gray-300 mb-2">Your Rank</div><div class="flex items-center justify-between">
        <div class="font-semibold text-pink-400">#${userRanking.rank}</div>
        <div class="text-gray-200">${
          userRanking.display_name || userRanking.username
        }</div>
        <div class="text-gray-400">${userRanking.wins}W/${
              userRanking.losses
            }L</div>
        <div class="text-cyan-400">WR ${userRanking.win_rate}%</div>
      </div></div>`
          : ""
      }
      <div class="space-y-2">
        ${list
          .map(
            (p: any, i: number) => `
          <div class="leaderboard-card flex items-center justify-between">
            <div class="font-semibold text-cyan-300">#${i + 1}</div>
            <div class="flex items-center gap-3">
              <img src="${
                p.oauth_avatar_url ||
                p.avatar_url
              }" class="w-8 h-8 rounded-full border border-gray-700" alt="">
              <div class="text-gray-200">${p.display_name || p.username}</div>
            </div>
            <div class="text-gray-400">${p.wins}W/${p.losses}L</div>
            <div class="text-cyan-400">WR ${p.win_rate}%</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  } catch (e) {
    const content = container.querySelector("#leaderboard-content")!;
    content.innerHTML = `<div class="p-3 border border-red-600/60 bg-red-900/30 rounded text-red-200">Failed to load leaderboard.</div>`;
  }
}
