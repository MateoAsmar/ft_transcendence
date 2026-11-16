import { renderBackground, renderNavbar, renderBackButton } from '../../shared/ui/layout';
import { ui } from './utils';

export async function render(container: HTMLElement){
  container.innerHTML = `
  <div class="min-h-screen flex items-center justify-center p-3 xs:p-4 cyber-grid bg-black text-white">
    <div class="w-full max-w-sm xs:max-w-md relative">
      <div class="text-center mb-6 xs:mb-8">
        <h1 class="text-3xl xs:text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 animate-pulse-slow">ft_transcendence</h1>
        <div class="w-20 xs:w-24 h-0.5 bg-gradient-to-r from-cyan-400 to-pink-500 mx-auto mb-4 xs:mb-6"></div>
        <h2 class="text-xl xs:text-2xl font-semibold text-cyan-400 mb-2">Two-Factor Authentication</h2>
        <p class="text-gray-400 text-xs xs:text-sm">Enter the 6-digit code sent to your email</p>
      </div>
      <div class="bg-black/50 backdrop-blur-sm border border-cyan-400/30 rounded-lg p-6 xs:p-8">
        <form id="twoFAForm" class="space-y-4 xs:space-y-6">
          <div>
            <label for="code" class="block text-cyan-400 text-xs xs:text-sm font-medium mb-1 xs:mb-2">Verification Code</label>
            <input
              id="code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              autocomplete="one-time-code"
              class="code-input w-full px-3 xs:px-4 py-2 xs:py-3 rounded-lg text-white text-center text-xl xs:text-2xl font-mono tracking-wider border-0"
              placeholder="000000"
              required
            />
            <p class="text-gray-400 text-xs mt-1">Auto-verifies when 6 digits entered</p>
          </div>
          <div id="verifyStatus" class="text-center text-gray-400 text-xs xs:text-sm mt-3 opacity-0 transition-opacity duration-300">
            <div class="flex items-center justify-center space-x-2"><div class="animate-spin rounded-full h-4 w-4 border-2 border-cyan-400 border-t-transparent"></div><span>Verifying code...</span></div>
          </div>
        </form>
        <div class="mt-4 text-center pt-4 border-t border-cyan-400/20">
          <a href="/login" data-link class="text-pink-400 hover:text-pink-300 text-sm">← Back to Login</a>
        </div>
      </div>
    </div>
  </div>`;

  const form = container.querySelector('#twoFAForm') as HTMLFormElement;
  const codeInput = container.querySelector('#code') as HTMLInputElement;
  const verifyStatus = container.querySelector('#verifyStatus') as HTMLElement;

  const partialToken = localStorage.getItem('partialAuthToken');
  if (!partialToken) { console.log('No partial token, redirecting'); (window as any).navigate('/login'); return; }

  codeInput.addEventListener('input', (e: any) => {
    let value = e.target.value.replace(/\D/g,'');
    if (value.length>6) value=value.slice(0,6);
    e.target.value=value;
    if (value.length===6){
      verifyStatus.classList.remove('opacity-0');
      verifyStatus.classList.add('opacity-100');
      form.requestSubmit();
    } else {
      verifyStatus.classList.add('opacity-0');
      verifyStatus.classList.remove('opacity-100');
    }
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    document.querySelectorAll('.error-message, .success-message').forEach(m=>m.remove());
    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) { ui.showError('Enter a valid 6-digit code'); return; }
    try {
      const apiUrl = '/api';
      const response = await fetch(`${apiUrl}/auth/verify-2fa`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body: JSON.stringify({ tempToken: partialToken, code }) });
      const result = await response.json();
      if (response.ok) {
        localStorage.removeItem('partialAuthToken');
        // Fetch full user profile data from /api/profile/me
        try {
          const profileRes = await fetch('/api/profile/me', { credentials: 'include' });
          if (profileRes.ok) {
            const userData = await profileRes.json();
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (e) {
          console.error('Failed to fetch user profile:', e);
        }
        ui.showSuccess('2FA success! Redirecting...');
        setTimeout(()=> (window as any).navigate('/dashboard'), 1200);
      } else ui.showError(result.error || 'Invalid verification code');
    } catch(err){ console.error(err); ui.showError('Unexpected error'); }
    finally { verifyStatus.classList.add('opacity-0'); verifyStatus.classList.remove('opacity-100'); }
  });

  codeInput.focus();
}

