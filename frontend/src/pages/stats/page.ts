import { Chart, registerables } from 'chart.js';
import { getCachedUser } from '../../shared/auth';
import { renderBackButton, renderBackground, renderNavbar } from '../../shared/ui/layout';
import { authFetch } from '../../shared/auth';

// Register Chart.js components
Chart.register(...registerables);

export async function render(container: HTMLElement) {
  const signedIn = getCachedUser() !== null;
  container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden text-white">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col">
        ${renderNavbar({
          title: 'Stats',
          subtitle: 'Track your performance and progress across every match.',
          rightContent: renderBackButton({ href: '/dashboard', label: 'Back to Dashboard' }),
        })}

        <main class="flex-1 p-3 xs:p-4">
          <div class="max-w-4xl mx-auto space-y-4">
            ${!signedIn ? `<div class='p-3 border border-yellow-600/60 bg-yellow-900/30 rounded text-yellow-200 text-sm'>Sign in to manage your statistics.</div>`: ''}
            <div class="glass-card p-3 xs:p-4">
              <div id="stats" class="">Loading...</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  if (!signedIn) return;

  const statsEl = container.querySelector('#stats')!;
  let profileData: any = null;

  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    try { profileData = JSON.parse(storedUser); } catch { profileData = null; }
  }

  if (!profileData) {
    try {
      const profileRes = await authFetch('/api/profile/me');
      if (profileRes.ok) {
        profileData = await profileRes.json();
        localStorage.setItem('user', JSON.stringify(profileData));
      }
    } catch (error) {
      // Ignore profile fetch errors; stats will still render
    }
  }

  const getAvatarUrl = (profile: any): string => {
    if (!profile) return '/uploads/default-avatar.jpg';
    return (
      profile.avatar_url ||
      profile.oauth_avatar_url ||
      profile.avatar ||
      '/uploads/default-avatar.jpg'
    );
  };

  let winLossChart: Chart | null = null;
  let performanceChart: Chart | null = null;

  async function loadLeaderboard() {
    const leaderboardEl = container.querySelector('#leaderboard-content');
    if (!leaderboardEl) return;

    try {
      const res = await authFetch('/api/leaderboard');
      if (!res.ok) throw new Error('Failed to load leaderboard');
      const data = await res.json();
      const list = (data.leaderboard || []) as any[];
      const userRanking = data.userRanking;

      leaderboardEl.innerHTML = `
        ${
          userRanking
            ? `<div class="p-4 rounded bg-gradient-to-r from-pink-900/40 to-purple-900/40 border border-pink-500/50">
                <div class="text-sm text-gray-300 mb-2 font-semibold">Your Rank</div>
                <div class="flex items-center justify-between">
                  <div class="font-bold text-2xl text-pink-400">#${userRanking.rank}</div>
                  <div class="text-gray-200 font-medium">${userRanking.display_name || userRanking.username}</div>
                  <div class="text-gray-400">${userRanking.wins}W/${userRanking.losses}L</div>
                  <div class="text-cyan-400 font-semibold">WR ${userRanking.win_rate}%</div>
                </div>
              </div>`
            : ''
        }
        <div class="space-y-2">
          ${list
            .map(
              (p: any, i: number) => `
            <div class="p-4 rounded bg-gray-800/60 border border-gray-700 hover:border-cyan-500/50 transition-all flex items-center justify-between">
              <div class="font-semibold text-cyan-300 text-lg">#${i + 1}</div>
              <div class="flex items-center gap-3">
                <img src="${p.oauth_avatar_url || p.avatar_url}" class="w-8 h-8 rounded-full border border-gray-700 object-cover" alt="">
                <div class="text-gray-200 font-medium">${p.display_name || p.username}</div>
              </div>
              <div class="text-gray-400">${p.wins}W/${p.losses}L</div>
              <div class="text-cyan-400 font-semibold">WR ${p.win_rate}%</div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    } catch (e) {
      leaderboardEl.innerHTML = `<div class="p-3 border border-red-600/60 bg-red-900/30 rounded text-red-200">Failed to load leaderboard.</div>`;
    }
  }

  async function loadStats(){
    const res = await authFetch('/api/profile/stats');
    if (!res.ok) { statsEl.textContent = 'Failed to load'; return; }
    const payload = await res.json();
    const s = payload.stats || payload;
    const wr = s.total_games ? Math.round((s.wins/s.total_games)*100) : 0;
    const losses = s.losses || (s.total_games - s.wins);
    const avatar = getAvatarUrl(profileData);
    const displayName = profileData?.display_name || profileData?.username || 'Player';
    const email = profileData?.email || '';

    const recentMatches = Array.isArray((payload.recent_matches ?? s.recent_matches)) ? (payload.recent_matches ?? s.recent_matches) : [];
    const recentMarkup = recentMatches.length
      ? `<div class="space-y-3 mt-6">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wide">Recent Opponents</h3>
          ${recentMatches.slice(0, 5).map((match: any) => {
            const opponent = match.opponent || match;
            const opponentName = opponent.display_name || opponent.username || 'Unknown';
            const opponentAvatar = opponent.avatar_url || opponent.oauth_avatar_url || '/uploads/default-avatar.jpg';
            const result = match.result || match.outcome || '';
            return `
              <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-900/60 border border-gray-800">
                <img src="${opponentAvatar}" alt="${opponentName}" class="w-10 h-10 rounded-full border border-gray-700 object-cover" />
                <div class="flex-1">
                  <div class="text-white font-medium">${opponentName}</div>
                  <div class="text-xs text-gray-400">${match.played_at ? new Date(match.played_at).toLocaleString() : 'Recent match'}</div>
                </div>
                ${result ? `<span class="text-xs font-semibold ${result.toLowerCase() === 'win' ? 'text-green-400' : result.toLowerCase() === 'loss' ? 'text-red-400' : 'text-gray-400'}">${result}</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>`
      : '';

    statsEl.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div class="flex items-center gap-4">
          <img src="${avatar}" alt="${displayName}" class="w-16 h-16 rounded-full border border-gray-700 object-cover" />
          <div>
            <h2 class="text-xl font-semibold text-white">${displayName}</h2>
            ${email ? `<p class="text-sm text-gray-400">${email}</p>` : ''}
          </div>
        </div>
        <div class="text-sm text-gray-400">
          Overall performance snapshot
        </div>
      </div>

      <!-- Stats Cards -->
      <div class='grid grid-cols-1 sm:grid-cols-3 gap-4 text-center mb-8'>
        <div class='p-4 rounded bg-gray-800/60 border border-gray-700'>
          <div class='text-gray-400 text-sm'>Games</div>
          <div class='text-2xl font-semibold text-white mt-1'>${s.total_games}</div>
        </div>
        <div class='p-4 rounded bg-gray-800/60 border border-gray-700'>
          <div class='text-gray-400 text-sm'>Wins</div>
          <div class='text-2xl font-semibold text-green-400 mt-1'>${s.wins}</div>
        </div>
        <div class='p-4 rounded bg-gray-800/60 border border-gray-700'>
          <div class='text-gray-400 text-sm'>Win %</div>
          <div class='text-2xl font-semibold text-cyan-400 mt-1'>${wr}%</div>
        </div>
      </div>

      <!-- Data Visualization Section -->
      <div class="space-y-6">
        <h3 class="text-lg font-semibold text-white">Performance Analytics</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Win/Loss Ratio Chart -->
          <div class="p-4 rounded bg-gray-800/60 border border-gray-700">
            <h4 class="text-sm font-semibold text-gray-300 mb-4 text-center">Win/Loss Distribution</h4>
            <div class="relative" style="height: 250px;">
              <canvas id="winLossChart"></canvas>
            </div>
          </div>

          <!-- Performance Breakdown Chart -->
          <div class="p-4 rounded bg-gray-800/60 border border-gray-700">
            <h4 class="text-sm font-semibold text-gray-300 mb-4 text-center">Performance Breakdown</h4>
            <div class="relative" style="height: 250px;">
              <canvas id="performanceChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Leaderboard Section -->
      <div class="space-y-4 mt-8">
        <h3 class="text-lg font-semibold text-white">Global Leaderboard</h3>
        <div id="leaderboard-content" class="space-y-4">
          <div class="text-center text-gray-400">Loading leaderboard...</div>
        </div>
      </div>

      ${recentMarkup}
    `;

    // Destroy existing charts if they exist
    if (winLossChart) {
      winLossChart.destroy();
    }
    if (performanceChart) {
      performanceChart.destroy();
    }

    // Create Win/Loss Pie Chart
    const winLossCanvas = document.getElementById('winLossChart') as HTMLCanvasElement;
    if (winLossCanvas && s.total_games > 0) {
      winLossChart = new Chart(winLossCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Wins', 'Losses'],
          datasets: [{
            data: [s.wins, losses],
            backgroundColor: [
              'rgba(34, 197, 94, 0.8)',  // Green for wins
              'rgba(239, 68, 68, 0.8)',   // Red for losses
            ],
            borderColor: [
              'rgba(34, 197, 94, 1)',
              'rgba(239, 68, 68, 1)',
            ],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#d1d5db',
                font: {
                  size: 12
                },
                padding: 15
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#d1d5db',
              borderColor: '#374151',
              borderWidth: 1,
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const total = s.total_games;
                  const percentage = ((value / total) * 100).toFixed(1);
                  return label + ': ' + value + ' (' + percentage + '%)';
                }
              }
            }
          }
        }
      });
    }

    // Create Performance Bar Chart
    const performanceCanvas = document.getElementById('performanceChart') as HTMLCanvasElement;
    if (performanceCanvas) {
      performanceChart = new Chart(performanceCanvas, {
        type: 'bar',
        data: {
          labels: ['Wins', 'Losses', 'Total Games'],
          datasets: [{
            label: 'Match Statistics',
            data: [s.wins, losses, s.total_games],
            backgroundColor: [
              'rgba(34, 197, 94, 0.8)',
              'rgba(239, 68, 68, 0.8)',
              'rgba(34, 211, 238, 0.8)',
            ],
            borderColor: [
              'rgba(34, 197, 94, 1)',
              'rgba(239, 68, 68, 1)',
              'rgba(34, 211, 238, 1)',
            ],
            borderWidth: 2,
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                color: '#d1d5db',
                font: {
                  size: 11
                },
                stepSize: 1
              },
              grid: {
                color: 'rgba(75, 85, 99, 0.3)'
              }
            },
            x: {
              ticks: {
                color: '#d1d5db',
                font: {
                  size: 11
                }
              },
              grid: {
                display: false
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#d1d5db',
              borderColor: '#374151',
              borderWidth: 1
            }
          }
        }
      });
    }
  }

  await loadStats();
  await loadLeaderboard();

  const reset = container.querySelector('#reset') as HTMLButtonElement | null;
  reset?.addEventListener('click', async ()=>{
    if (!confirm('Reset all your stats?')) return;
    const res = await authFetch('/api/profile/reset-stats', { method: 'POST' });
    if (res.ok) await loadStats(); else alert('Failed to reset');
  });
}

// Cleanup function to destroy charts when page is unmounted
export function cleanup() {
  // Destroy any existing Chart.js instances
  Chart.getChart('winLossChart')?.destroy();
  Chart.getChart('performanceChart')?.destroy();
}

