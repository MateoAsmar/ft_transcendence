import { authFetch } from "../../shared/auth";
import { validateAuth, getCachedUser, clearCachedUser } from "../../shared/auth";
import { renderBackground, renderNavbar, renderBackButton } from "../../shared/ui/layout";

export async function render(container: HTMLElement) {
  // Check if viewing another user's profile
  const urlParams = new URLSearchParams(window.location.search);
  const viewingUsername = urlParams.get('username');
  const isViewingOtherUser = !!viewingUsername;

  container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden text-white">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col overflow-y-auto">
        ${renderNavbar({
          title: isViewingOtherUser ? `${viewingUsername}'s Profile` : "Profile",
          subtitle: isViewingOtherUser ? `View ${viewingUsername}'s stats and match history.` : "Manage your account details, security preferences, and appearance.",
          rightContent: `
            ${renderBackButton({ href: "/dashboard", label: "Back to Dashboard" })}
          `,
        })}

        <main class="flex-1 p-4 xs:p-6">
      <div class="max-w-6xl mx-auto grid gap-4 xs:gap-6 lg:grid-cols-3">
        <div class="lg:col-span-1">
          <div class="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg p-4 xs:p-6 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            <div class="text-center">
              <div class="relative mx-auto w-24 xs:w-32 h-24 xs:h-32 mb-3 xs:mb-4">
                <img id="user-avatar" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23374151' width='200' height='200'/%3E%3Ctext fill='%23D1D5DB' font-family='sans-serif' font-size='100' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E%3F%3C/text%3E%3C/svg%3E" class="w-full h-full rounded-full object-cover border-4 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]" alt="Profile"/>
              </div>
              <div class="space-y-1 xs:space-y-2">
                <h2 id="user-displayname" class="text-lg xs:text-xl font-bold text-white">Loading…</h2>
                <p id="user-username" class="text-sm xs:text-base text-gray-400">@pending</p>
                <div id="auth-provider-badge" class="hidden">
                  <span class="inline-block px-3 py-1 bg-blue-600/20 border border-blue-500 text-blue-400 rounded-full text-sm">
                    <span id="auth-provider-text">OAuth</span>
                  </span>
                </div>
              </div>
              <div id="profile-actions" class="mt-4 xs:mt-6 space-y-2">
                <button id="edit-profile-btn" class="w-full px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_20px_rgba(34,211,238,0.6)]">Edit Profile</button>
                <button id="reset-avatar-btn" class="w-full px-4 py-2 bg-gray-600/20 border border-gray-500 text-gray-300 rounded hover:bg-gray-600/30 transition-all">Reset Avatar</button>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2 space-y-4 xs:gap-6">
          <div class="grid grid-cols-2 gap-3 xs:gap-4">
            <div class="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg p-4 xs:p-6 text-center shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(34,211,238,0.2)] transition-all">
              <h3 class="text-gray-400 text-xs xs:text-sm uppercase tracking-wide">Total Games</h3>
              <p id="total-games" class="text-2xl xs:text-3xl font-bold text-white mt-1 xs:mt-2">--</p>
            </div>
            <div class="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg p-4 xs:p-6 text-center shadow-[0_0_20px_rgba(34,197,94,0.1)] hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] transition-all">
              <h3 class="text-gray-400 text-xs xs:text-sm uppercase tracking-wide">Wins</h3>
              <p id="total-wins" class="text-2xl xs:text-3xl font-bold text-green-400 mt-1 xs:mt-2">--</p>
            </div>
            <div class="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg p-4 xs:p-6 text-center shadow-[0_0_20px_rgba(239,68,68,0.1)] hover:shadow-[0_0_30px_rgba(239,68,68,0.2)] transition-all">
              <h3 class="text-gray-400 text-xs xs:text-sm uppercase tracking-wide">Losses</h3>
              <p id="total-losses" class="text-2xl xs:text-3xl font-bold text-red-400 mt-1 xs:mt-2">--</p>
            </div>
            <div class="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg p-4 xs:p-6 text-center shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:shadow-[0_0_30px_rgba(34,211,238,0.2)] transition-all">
              <h3 class="text-gray-400 text-xs xs:text-sm uppercase tracking-wide">Win Rate</h3>
              <p id="win-rate" class="text-2xl xs:text-3xl font-bold text-cyan-400 mt-1 xs:mt-2">--%</p>
            </div>
          </div>

          <div class="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg shadow-[0_0_30px_rgba(34,211,238,0.1)]">
            <div class="p-4 xs:p-6 border-b border-gray-700"><h3 class="text-base xs:text-lg font-bold text-white">Match History</h3></div>
            <div class="p-4 xs:p-6"><div id="history" class="space-y-3 text-gray-300">${
              getCachedUser() !== null ? "Loading..." : "Sign in to view match history"
            }</div></div>
          </div>
        </div>
      </div>
    </main>

      </div>
    </div>

    <!-- Edit Profile Modal (only show for own profile) -->
    ${
      getCachedUser() !== null && !isViewingOtherUser
        ? `<div id="edit-modal" class="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4">
      <div class="bg-gray-900 border border-cyan-400 rounded-lg w-full max-w-md shadow-[0_0_50px_rgba(34,211,238,0.3)]">
        <div class="p-6 border-b border-gray-700">
          <h3 class="text-lg font-bold text-cyan-400">Edit Profile</h3>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-gray-400 text-sm font-medium mb-2">Username</label>
            <input type="text" id="edit-username" class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-cyan-400" placeholder="Enter username" />
          </div>
          <div>
            <label class="block text-gray-400 text-sm font-medium mb-2">Display Name</label>
            <input type="text" id="edit-displayname" class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-cyan-400" placeholder="Enter display name" />
          </div>
          <div>
            <label class="block text-gray-400 text-sm font-medium mb-2">Upload Avatar</label>
            <input type="file" id="upload-avatar" accept="image/*" class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700" />
            <p class="text-xs text-gray-500 mt-1">Max size: 5MB</p>
          </div>
        </div>
        <div class="p-6 border-t border-gray-700 flex gap-3">
          <button id="save-profile-btn" class="flex-1 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-all">Save Changes</button>
          <button id="cancel-edit-btn" class="flex-1 px-4 py-2 bg-gray-600/20 border border-gray-500 text-gray-400 rounded hover:bg-gray-600/30 transition-all">Cancel</button>
        </div>
      </div>
    </div>`
        : ""
    }
  </div>`;

  let authed = getCachedUser() !== null;
  if (!authed) authed = await validateAuth() !== null;
  if (!authed) { (window as any).navigate('/login', true); return; }

  // Pagination state
  let currentPage = 1;
  const limit = 10;
  let totalPages = 1;
  let totalMatches = 0;

  // Function to load match history with pagination
  async function loadMatchHistory(page: number) {
    try {
      const historyEndpoint = isViewingOtherUser
        ? `/api/profile/${viewingUsername}/history?page=${page}&limit=${limit}`
        : `/api/profile/history?page=${page}&limit=${limit}`;
      const histRes = await authFetch(historyEndpoint);
      if (histRes.ok) {
        const data = await histRes.json();
        console.log('📊 Raw response data:', data);

        const history = (data.history || []) as any[];
        const pagination = data.pagination || {};

        console.log('📊 Pagination object:', pagination);

        currentPage = pagination.page || 1;
        totalPages = pagination.totalPages || 1;
        totalMatches = pagination.total || 0;

        console.log('📊 Match history loaded:', { page: currentPage, totalPages, totalMatches, matches: history.length });

        const hist = container.querySelector("#history")! as HTMLElement;

        if (history.length === 0 && currentPage === 1) {
          hist.innerHTML = `<div class='text-gray-400'>No recent matches.</div>`;
          return;
        }

        const matchesHTML = history
          .map(
            (h) => `
          <div class='flex items-center justify-between p-3 rounded bg-gray-900/40 border border-gray-800'>
            <div class='text-gray-200'>vs ${h.opponent_username}</div>
            <div class='text-white font-semibold'>${h.player_score} - ${h.opponent_score}</div>
            <div class='text-sm ${
              h.result === "win" ? "text-green-400" : "text-red-400"
            }'>${(h.result || "").toString().toUpperCase()}</div>
            <div class='text-gray-500 text-sm'>${new Date(h.played_at).toLocaleDateString()}</div>
          </div>
        `
          )
          .join("");

        const paginationHTML = totalPages > 1 ? `
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
            <button id="prev-page" ${currentPage === 1 ? 'disabled' : ''}
              class="px-4 py-2 bg-cyan-600/80 hover:bg-cyan-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-sm font-medium transition-all">
              Previous
            </button>
            <div class="text-gray-400 text-sm">
              Page ${currentPage} of ${totalPages} <span class="text-gray-500">(${totalMatches} total)</span>
            </div>
            <button id="next-page" ${currentPage === totalPages ? 'disabled' : ''}
              class="px-4 py-2 bg-cyan-600/80 hover:bg-cyan-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-sm font-medium transition-all">
              Next
            </button>
          </div>
        ` : '';

        hist.innerHTML = matchesHTML + paginationHTML;

        // Add event listeners for pagination
        const prevBtn = container.querySelector('#prev-page');
        const nextBtn = container.querySelector('#next-page');

        if (prevBtn) {
          prevBtn.addEventListener('click', () => loadMatchHistory(currentPage - 1));
        }
        if (nextBtn) {
          nextBtn.addEventListener('click', () => loadMatchHistory(currentPage + 1));
        }
      }
    } catch (err) {
      console.error('Error loading match history:', err);
    }
  }

  // Load profile and stats
  try {
    const profileEndpoint = isViewingOtherUser ? `/api/profile/${viewingUsername}` : "/api/profile/me";
    const statsEndpoint = isViewingOtherUser ? `/api/profile/${viewingUsername}/stats` : "/api/profile/stats";

    const [meRes, statsRes] = await Promise.all([
      authFetch(profileEndpoint),
      authFetch(statsEndpoint),
    ]);

    if (meRes.ok) {
      const me = await meRes.json();
      const name = me.displayname || me.username;

      // Avatar priority: custom uploaded > oauth avatar > default
      let avatarUrl = "/uploads/default-avatar.jpg";

      if (me.picture && me.picture !== "/uploads/default-avatar.jpg") {
        // Custom uploaded avatar - already has the correct path from backend
        avatarUrl = me.picture;
      } else if (me.oauth_avatar_url) {
        // OAuth provider avatar
        avatarUrl = me.oauth_avatar_url;
      }

      const provider = me.auth_provider;

      const userEl = (sel: string) =>
        container.querySelector(sel)! as HTMLElement;
      userEl("#user-displayname").textContent = name;
      userEl("#user-username").textContent = "@" + me.username;

      const img = container.querySelector(
        "#user-avatar"
      ) as HTMLImageElement | null;
      if (img) {
        // Use a flag to prevent infinite retry loops
        let hasErrored = false;
        img.onerror = () => {
          if (!hasErrored) {
            hasErrored = true;
            // Fallback to default avatar from frontend public folder
            img.src = "/uploads/default-avatar.jpg";
          }
        };
        img.src = avatarUrl;
      }

      if (provider && provider !== "manual") {
        const badge = userEl("#auth-provider-badge");
        badge.classList.remove("hidden");
        userEl("#auth-provider-text").textContent =
          provider === "google" ? "Google Account" : "OAuth Account";
      }

      // Hide edit buttons when viewing another user's profile
      if (isViewingOtherUser) {
        const profileActions = container.querySelector("#profile-actions");
        if (profileActions) {
          profileActions.classList.add("hidden");
        }
      }
    }

    if (statsRes && statsRes.ok) {
      const stats = await statsRes.json();
      const games = stats.total_games ?? 0;
      const wins = stats.wins ?? 0;
      const losses = stats.losses ?? Math.max(0, games - wins);
      const wr = games > 0 ? Math.round((wins / games) * 100) : 0;
      const set = (id: string, v: string) => {
        const el = container.querySelector("#" + id);
        if (el) el.textContent = v;
      };
      set("total-games", String(games));
      set("total-wins", String(wins));
      set("total-losses", String(losses));
      set("win-rate", `${wr}%`);
    }

    // Load match history with pagination
    await loadMatchHistory(1);
  } catch (err) {
    console.error("Error loading profile:", err);
  }

  // Modal handlers
  const editProfileBtn = container.querySelector(
    "#edit-profile-btn"
  ) as HTMLButtonElement | null;
  const editModal = container.querySelector(
    "#edit-modal"
  ) as HTMLElement | null;
  const cancelEditBtn = container.querySelector(
    "#cancel-edit-btn"
  ) as HTMLButtonElement | null;
  const saveProfileBtn = container.querySelector(
    "#save-profile-btn"
  ) as HTMLButtonElement | null;

  if (editProfileBtn && editModal) {
    editProfileBtn.addEventListener("click", () => {
      editModal.classList.remove("hidden");
      editModal.classList.add("flex");
    });
  }

  if (cancelEditBtn && editModal) {
    cancelEditBtn.addEventListener("click", () => {
      editModal.classList.add("hidden");
      editModal.classList.remove("flex");
    });
  }

  if (saveProfileBtn && editModal) {
    saveProfileBtn.addEventListener("click", async () => {
      const usernameInput = container.querySelector(
        "#edit-username"
      ) as HTMLInputElement;
      const displaynameInput = container.querySelector(
        "#edit-displayname"
      ) as HTMLInputElement;
      const uploadAvatarInput = container.querySelector(
        "#upload-avatar"
      ) as HTMLInputElement;

      try {
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = "Saving...";

        // Update profile text fields
        if (usernameInput?.value || displaynameInput?.value) {
          const body: any = {};
          if (usernameInput?.value) body.username = usernameInput.value;
          if (displaynameInput?.value)
            body.display_name = displaynameInput.value;

          const res = await authFetch("/api/profile/me", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const result = await res.json();
          console.log('📝 Profile update result:', result);

          if (!result.success) {
            showToast(result.message || result.error || "Failed to update profile", "error");
            return;
          }
        }

        // Upload avatar file if provided
        if (uploadAvatarInput?.files?.[0]) {
          const formData = new FormData();
          formData.append("avatar", uploadAvatarInput.files[0]);

          const res = await authFetch("/api/profile/upload-avatar", {
            method: "POST",
            body: formData,
          });

          const result = await res.json();
          if (!result.success && result.error) {
            showToast(result.error || "Failed to upload avatar", "error");
            return;
          }
        }

        // Reload the page to show updated info
        editModal.classList.add("hidden");
        editModal.classList.remove("flex");
        (window as any).navigate("/profile");
      } catch (error) {
        console.error("Error updating profile:", error);
        showToast("Failed to update profile", "error");
      } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = "Save Changes";
      }
    });
  }

  // Reset avatar action
  const resetBtn = container.querySelector(
    "#reset-avatar-btn"
  ) as HTMLButtonElement | null;
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (!confirm("Reset avatar to default?")) return;

      resetBtn.disabled = true;
      try {
        await authFetch("/api/profile/avatar", { method: "DELETE" });
        // Reload avatar from profile
        (window as any).navigate("/profile");
      } catch (err) {
        console.error("Error resetting avatar:", err);
        showToast("Failed to reset avatar", "error");
      } finally {
        resetBtn.disabled = false;
      }
    });
  }

  // Toast notification helper
  function showToast(message: string, type: "success" | "error") {
    console.log(`🍞 Toast: [${type}] ${message}`);

    const toast = document.createElement("div");
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg border-2 shadow-2xl font-semibold ${
      type === "success"
        ? "bg-green-600 border-green-400 text-white"
        : "bg-red-600 border-red-400 text-white"
    }`;
    toast.style.zIndex = "9999";
    toast.textContent = message;

    document.body.appendChild(toast);

    // Fade in animation
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100px)";
    toast.style.transition = "all 0.3s ease-out";

    setTimeout(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(0)";
    }, 10);

    // Remove after 4 seconds
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}
