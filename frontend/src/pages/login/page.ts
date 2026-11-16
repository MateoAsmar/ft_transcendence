import { renderBackground, renderNavbar } from '../../shared/ui/layout';
import { authApi, ui, validation } from './utils';

export async function render(container: HTMLElement){
  const headerActions = `<a data-link href="/register" class="px-3 py-2 border border-cyan-400/60 rounded-lg text-cyan-300 hover:text-white hover:border-cyan-300 transition-colors text-sm">Sign up</a>`;
  container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden text-white">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col">
        ${renderNavbar({
          title: 'Sign In',
          subtitle: 'Access your ft_transcendence account to continue playing.',
          rightContent: headerActions,
        })}

        <main class="flex-1 flex items-center justify-center p-2 xs:p-4 sm:p-6">
          <div class="relative w-full max-w-xs xs:max-w-sm sm:max-w-md">
            <div class="absolute inset-0 rounded-xl xs:rounded-2xl blur-sm opacity-90 animate-border animate-glow"></div>
            <div class="relative bg-gray-900/90 backdrop-blur-sm rounded-xl xs:rounded-2xl p-4 xs:p-6 sm:p-8 border border-gray-700 shadow-2xl">
        <div class="text-center mb-6 xs:mb-8">
          <h1 class="text-2xl xs:text-3xl font-bold text-cyan-400 mb-2 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">Welcome Back</h1>
          <h2 class="text-lg xs:text-xl font-bold text-pink-400 drop-shadow-[0_0_10px_rgba(236,72,153,0.8)]">Player</h2>
        </div>
        <form id="loginForm" class="space-y-4 xs:space-y-6">
          <div><input id="username" name="username" type="text" autocomplete="username" placeholder="Username" class="w-full px-3 xs:px-4 py-2 xs:py-3 bg-gray-800/50 border border-cyan-400/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300 text-base" required /></div>
          <div><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Password" class="w-full px-3 xs:px-4 py-2 xs:py-3 bg-gray-800/50 border border-cyan-400/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300 text-base" required /></div>
          <button type="submit" class="w-full py-2 xs:py-3 bg-gray-800/50 border-2 border-cyan-400 rounded-lg text-cyan-400 font-bold text-base xs:text-lg hover:bg-cyan-400/10 hover:border-cyan-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50 shadow-[0_0_20px_rgba(34,211,238,0.5)] hover:shadow-[0_0_30px_rgba(34,211,238,0.8)]">LOG IN</button>
        </form>
        <div class="mt-6 xs:mt-8 space-y-3 xs:space-y-4">
          <div class="relative"><div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-600"></div></div><div class="relative flex justify-center text-xs xs:text-sm"><span class="px-2 bg-gray-900 text-gray-400">Or continue with</span></div></div>
          <div class="space-y-2 xs:space-y-3">
            <button id="google-login" type="button" class="w-full py-2 xs:py-3 px-3 xs:px-4 bg-gray-800/50 border border-gray-600 rounded-lg text-white font-medium hover:bg-gray-700/50 hover:border-gray-500 transition-all duration-300 flex items-center justify-center space-x-2 xs:space-x-3 text-sm xs:text-base">
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
        <div class="mt-6 xs:mt-8 text-center">
          <a href="/register" data-link class="text-pink-400 hover:text-pink-300 text-xs xs:text-sm transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-opacity-50 rounded">Don't have an account? Sign up</a>
        </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  const form = container.querySelector('#loginForm') as HTMLFormElement;
  const usernameInput = container.querySelector('#username') as HTMLInputElement;
  const passwordInput = container.querySelector('#password') as HTMLInputElement;
  const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  const originalButtonText = submitButton.textContent || 'LOG IN';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.error-message, .success-message').forEach(m=>m.remove());
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username) return ui.showError('Username is required');
    if (!validation.username(username)) return ui.showError('Username must be at least 3 characters long');
    if (!password) return ui.showError('Password is required');
    ui.setLoading(submitButton, true);
    try {
      const response = await authApi.login(username, password);
      if (response.success && response.data) {
        // Check if 2FA is required
        if ((response.data as any).requires2FA && (response.data as any).tempToken) {
          // 2FA enabled - go to 2FA page
          localStorage.setItem('partialAuthToken', (response.data as any).tempToken);
          ui.showSuccess('Check your email for the verification code.');
          setTimeout(()=> (window as any).navigate('/2fa'), 700);
        } else if ((response.data as any).token) {
          // 2FA disabled - direct login, fetch user profile data
          try {
            const profileRes = await fetch('/api/profile/me', { credentials: 'include' });
            if (profileRes.ok) {
              const userData = await profileRes.json();
              localStorage.setItem('user', JSON.stringify(userData));
            }
          } catch (e) {
            console.error('Failed to fetch user profile:', e);
          }
          ui.showSuccess('Login successful! Redirecting...');
          setTimeout(()=> (window as any).navigate('/dashboard'), 700);
        } else {
          ui.showError('Unexpected response from server');
        }
      } else {
        ui.showError(response.error || 'Login failed');
      }
    } catch(err){ console.error(err); ui.showError('Unexpected error'); }
    finally { submitButton.disabled=false; submitButton.textContent=originalButtonText; submitButton.classList.remove('opacity-50','cursor-not-allowed'); }
  });

  // Google Sign-In: redirect to backend OAuth endpoint (proxy-aware)
  const googleBtn = container.querySelector('#google-login') as HTMLButtonElement | null;
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      window.location.href = '/api/oauth/google';
    });
  }
}





