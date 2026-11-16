import { authFetch, getCachedUser, clearCachedUser } from '../../shared/auth';
import { renderBackground, renderNavbar, renderBackButton } from '../../shared/ui/layout';

export async function render(container: HTMLElement) {
  const signedIn = getCachedUser() !== null;
  const headerActions = `
    ${renderBackButton({ href: '/dashboard', label: 'Back to Dashboard' })}
  `.trim();
  const securityCard = `
            <div class="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg shadow-[0_0_30px_rgba(34,211,238,0.2)]">
              <div class="p-6 border-b border-gray-700">
                <h2 class="text-xl font-bold text-white">Security</h2>
              </div>
              <div class="p-6 space-y-6">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-lg font-semibold text-white">Two-Factor Authentication (2FA)</h3>
                    <p class="text-sm text-gray-400 mt-1">Add an extra layer of security by requiring a verification code sent to your email when logging in.</p>
                    <p id="twofa-status" class="text-sm mt-2">
                      <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium">
                        <span class="mr-2">●</span> Loading...
                      </span>
                    </p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="twofa-toggle" class="sr-only peer" disabled>
                    <div class="w-14 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-400/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-cyan-600"></div>
                  </label>
                </div>
              </div>
            </div>
  `.trim();
  const accountCard = `
            <div class="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg shadow-[0_0_30px_rgba(34,211,238,0.2)]">
              <div class="p-6 border-b border-gray-700">
                <h2 class="text-xl font-bold text-white">Account Information</h2>
              </div>
              <div class="p-6 space-y-4">
                <div>
                  <p class="text-sm text-gray-400">Username</p>
                  <p id="settings-username" class="text-white font-medium">Loading...</p>
                </div>
                <div>
                  <p class="text-sm text-gray-400">Email</p>
                  <p id="settings-email" class="text-white font-medium">Loading...</p>
                </div>
                <div>
                  <p class="text-sm text-gray-400">Account Type</p>
                  <p id="settings-auth-provider" class="text-white font-medium">Loading...</p>
                </div>
              </div>
            </div>
  `.trim();
  const gdprCard = `
            <div class="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg shadow-[0_0_30px_rgba(34,211,238,0.2)]">
              <div class="p-6 border-b border-gray-700">
                <h2 class="text-xl font-bold text-white">Data Management</h2>
                <p class="text-sm text-gray-400 mt-1">Manage your personal data and privacy</p>
              </div>
              <div class="p-6 space-y-4">
                <div class="flex items-start justify-between p-4 rounded-lg bg-gray-800/60 border border-gray-700">
                  <div class="flex-1">
                    <h3 class="text-base font-semibold text-white">Export Your Data</h3>
                    <p class="text-sm text-gray-400 mt-1">Download all your account data, including profile, games, and statistics in JSON format.</p>
                  </div>
                  <button id="export-data-btn" class="ml-4 px-4 py-2 bg-cyan-600/20 border border-cyan-500 text-cyan-400 rounded hover:bg-cyan-600/30 transition-all whitespace-nowrap">Export Data</button>
                </div>

                <div class="flex items-start justify-between p-4 rounded-lg bg-gray-800/60 border border-gray-700">
                  <div class="flex-1">
                    <h3 class="text-base font-semibold text-white">Anonymize Account</h3>
                    <p class="text-sm text-gray-400 mt-1">Remove your personal information while preserving game history. You won't be able to log in again.</p>
                  </div>
                  <button id="anonymize-account-btn" class="ml-4 px-4 py-2 bg-orange-600/20 border border-orange-500 text-orange-400 rounded hover:bg-orange-600/30 transition-all whitespace-nowrap">Anonymize</button>
                </div>

                <div class="flex items-start justify-between p-4 rounded-lg bg-gray-800/60 border border-red-900/30">
                  <div class="flex-1">
                    <h3 class="text-base font-semibold text-white">Delete Account</h3>
                    <p class="text-sm text-gray-400 mt-1">Permanently delete your account and all associated data. This action cannot be undone.</p>
                  </div>
                  <button id="delete-account-btn" class="ml-4 px-4 py-2 bg-red-600/20 border border-red-500 text-red-400 rounded hover:bg-red-600/30 transition-all whitespace-nowrap">Delete</button>
                </div>

                <div class="mt-4 pt-4 border-t border-gray-700">
                  <p class="text-sm text-gray-400">
                    Learn more about your data privacy rights in our
                    <a href="/privacy-policy" data-link class="text-cyan-400 hover:text-cyan-300 underline">Privacy Policy</a>
                  </p>
                </div>
              </div>
            </div>
  `.trim();
  const logoutCard = `
            <div class="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg shadow-[0_0_30px_rgba(34,211,238,0.2)]">
              <div class="p-6 border-b border-gray-700">
                <h2 class="text-xl font-bold text-white">Account Actions</h2>
              </div>
              <div class="p-6">
                <div class="flex items-start justify-between p-4 rounded-lg bg-gray-800/60 border border-red-900/30">
                  <div class="flex-1">
                    <h3 class="text-base font-semibold text-white">Logout</h3>
                    <p class="text-sm text-gray-400 mt-1">Sign out of your account on this device.</p>
                  </div>
                  <button id="logout" class="ml-4 px-4 py-2 bg-red-600/20 border border-red-500 text-red-400 rounded hover:bg-red-600/30 transition-all whitespace-nowrap">Logout</button>
                </div>
              </div>
            </div>
  `.trim();
    container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden text-white">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col">
        ${renderNavbar({
          title: 'Settings',
          subtitle: 'Customize notifications, security, and gameplay preferences.',
          rightContent: headerActions,
        })}

        <main class="flex-1 p-4 xs:p-6">
          <div class="max-w-4xl mx-auto space-y-6">
            ${!signedIn ? `<div class='p-4 border border-yellow-600/60 bg-yellow-900/30 rounded text-yellow-200'>Sign in to access these settings.</div>` : ''}
            ${signedIn ? `${securityCard}${accountCard}${gdprCard}${logoutCard}` : ''}
          </div>
        </main>
      </div>
    </div>
  `;

  const logoutBtn = container.querySelector('#logout') as HTMLButtonElement | null;
  logoutBtn?.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    clearCachedUser();
    (window as any).navigate('/login');
  });

  if (!signedIn) return;

  // Load user profile data
  try {
    const meRes = await authFetch('/api/profile/me');
    if (meRes.ok) {
      const me = await meRes.json();
      
      // Update account information
      const usernameEl = container.querySelector('#settings-username');
      const emailEl = container.querySelector('#settings-email');
      const providerEl = container.querySelector('#settings-auth-provider');

      if (usernameEl) usernameEl.textContent = me.username || 'N/A';
      if (emailEl) emailEl.textContent = me.email || 'N/A';
      if (providerEl) {
        const providerText = me.auth_provider === 'google' ? 'Google Account' :
                            me.auth_provider === 'manual' ? 'Local Account' :
                            'OAuth Account';
        providerEl.textContent = providerText;
      }

      // Update 2FA toggle state
      const twofaToggle = container.querySelector('#twofa-toggle') as HTMLInputElement;
      const twofaStatus = container.querySelector('#twofa-status');
      
      if (twofaToggle) {
        twofaToggle.checked = me.twofa_enabled || false;
        twofaToggle.disabled = false;
        
        // Update status text
        if (twofaStatus) {
          const statusHtml = me.twofa_enabled 
            ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-600/20 text-green-400 border border-green-500"><span class="mr-2">●</span> Enabled</span>`
            : `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-600/20 text-gray-400 border border-gray-500"><span class="mr-2">●</span> Disabled</span>`;
          twofaStatus.innerHTML = statusHtml;
        }

        // Handle toggle change
        twofaToggle.addEventListener('change', async () => {
          const newValue = twofaToggle.checked;
          twofaToggle.disabled = true;
          
          try {
            const res = await authFetch('/api/profile/2fa-preference', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ twofa_enabled: newValue })
            });

            if (res.ok) {
              // Update status display
              if (twofaStatus) {
                const statusHtml = newValue 
                  ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-600/20 text-green-400 border border-green-500"><span class="mr-2">●</span> Enabled</span>`
                  : `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-600/20 text-gray-400 border border-gray-500"><span class="mr-2">●</span> Disabled</span>`;
                twofaStatus.innerHTML = statusHtml;
              }
            } else {
              // Revert toggle on error
              twofaToggle.checked = !newValue;
              alert('Failed to update 2FA preference');
            }
          } catch (error) {
            console.error('Error updating 2FA:', error);
            twofaToggle.checked = !newValue;
            alert('Error updating 2FA preference');
          } finally {
            twofaToggle.disabled = false;
          }
        });
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }

  // Helper function to show custom alert modal
  const showAlertModal = (message: string, isError = false) => {
    return new Promise<void>((resolve) => {
      const modalHtml = `
        <div id="alert-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div class="bg-gray-900 border ${isError ? 'border-red-500/50' : 'border-cyan-500/50'} rounded-lg shadow-2xl max-w-md w-full mx-4 p-6">
            <p class="text-white mb-4 leading-relaxed">${message}</p>
            <button id="alert-ok" class="w-full px-4 py-2 ${isError ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-600 hover:bg-cyan-700'} text-white rounded transition-colors">OK</button>
          </div>
        </div>
      `;

      const modalDiv = document.createElement('div');
      modalDiv.innerHTML = modalHtml;
      document.body.appendChild(modalDiv);

      const okBtn = modalDiv.querySelector('#alert-ok') as HTMLButtonElement;
      okBtn.focus();

      okBtn.addEventListener('click', () => {
        modalDiv.remove();
        resolve();
      });
    });
  };

  // GDPR Data Management Handlers
  const exportDataBtn = container.querySelector('#export-data-btn') as HTMLButtonElement;
  exportDataBtn?.addEventListener('click', async () => {
    try {
      exportDataBtn.disabled = true;
      exportDataBtn.textContent = 'Exporting...';

      const res = await authFetch('/api/profile/export-data');
      if (res.ok) {
        const data = await res.json();
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my-data-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await showAlertModal('Your data has been exported successfully!');
      } else {
        await showAlertModal('Failed to export data. Please try again.', true);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      await showAlertModal('Error exporting data. Please try again.', true);
    } finally {
      exportDataBtn.disabled = false;
      exportDataBtn.textContent = 'Export Data';
    }
  });

  // Helper function to show custom confirmation modal
  const showConfirmModal = (title: string, message: string, confirmText: string, confirmWord: string, isDanger = false): Promise<boolean> => {
    return new Promise((resolve) => {
      const modalHtml = `
        <div id="confirm-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div class="bg-gray-900 border ${isDanger ? 'border-red-500/50' : 'border-gray-700'} rounded-lg shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 class="text-xl font-bold ${isDanger ? 'text-red-400' : 'text-white'} mb-3">${title}</h3>
            <p class="text-gray-300 mb-4 leading-relaxed">${message}</p>
            <p class="text-sm text-gray-400 mb-4">Type <strong class="text-white">"${confirmWord}"</strong> to confirm:</p>
            <input
              type="text"
              id="confirm-input"
              class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:border-cyan-500 focus:outline-none mb-4"
              placeholder="${confirmWord}"
              autocomplete="off"
            />
            <div class="flex gap-3">
              <button id="modal-cancel" class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors">Cancel</button>
              <button id="modal-confirm" class="flex-1 px-4 py-2 ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-600 hover:bg-cyan-700'} text-white rounded transition-colors">${confirmText}</button>
            </div>
          </div>
        </div>
      `;

      const modalDiv = document.createElement('div');
      modalDiv.innerHTML = modalHtml;
      document.body.appendChild(modalDiv);

      const input = modalDiv.querySelector('#confirm-input') as HTMLInputElement;
      const confirmBtn = modalDiv.querySelector('#modal-confirm') as HTMLButtonElement;
      const cancelBtn = modalDiv.querySelector('#modal-cancel') as HTMLButtonElement;

      input.focus();

      const cleanup = () => {
        modalDiv.remove();
      };

      confirmBtn.addEventListener('click', () => {
        if (input.value.trim() === confirmWord) {
          cleanup();
          resolve(true);
        } else {
          input.classList.add('border-red-500');
          input.focus();
        }
      });

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim() === confirmWord) {
          cleanup();
          resolve(true);
        }
      });
    });
  };

  const anonymizeBtn = container.querySelector('#anonymize-account-btn') as HTMLButtonElement;
  anonymizeBtn?.addEventListener('click', async () => {
    const confirmed = await showConfirmModal(
      'Anonymize Account',
      'Are you sure you want to anonymize your account? This will remove your personal information but preserve your game history. You will NOT be able to log in again.',
      'Anonymize',
      'ANONYMIZE',
      true
    );

    if (!confirmed) return;

    try {
      anonymizeBtn.disabled = true;
      anonymizeBtn.textContent = 'Processing...';

      const res = await authFetch('/api/profile/anonymize', { method: 'POST' });
      if (res.ok) {
        await showAlertModal('Your account has been anonymized. You will now be logged out.');
        clearCachedUser();
        (window as any).navigate('/login');
      } else {
        const data = await res.json();
        await showAlertModal(`Failed to anonymize account: ${data.message || 'Unknown error'}`, true);
        anonymizeBtn.disabled = false;
        anonymizeBtn.textContent = 'Anonymize';
      }
    } catch (error) {
      console.error('Error anonymizing account:', error);
      await showAlertModal('Error anonymizing account. Please try again.', true);
      anonymizeBtn.disabled = false;
      anonymizeBtn.textContent = 'Anonymize';
    }
  });

  const deleteBtn = container.querySelector('#delete-account-btn') as HTMLButtonElement;
  deleteBtn?.addEventListener('click', async () => {
    const confirmed = await showConfirmModal(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently delete ALL your data and cannot be undone.',
      'Delete',
      'DELETE',
      true
    );

    if (!confirmed) return;

    try {
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting...';

      const res = await authFetch('/api/profile/delete-account', { method: 'DELETE' });
      if (res.ok) {
        await showAlertModal('Your account has been deleted.');
        clearCachedUser();
        (window as any).navigate('/login');
      } else {
        const data = await res.json();
        await showAlertModal(`Failed to delete account: ${data.message || 'Unknown error'}`, true);
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      await showAlertModal('Error deleting account. Please try again.', true);
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete';
    }
  });
}



