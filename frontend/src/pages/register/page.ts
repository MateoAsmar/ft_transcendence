import { renderBackground, renderNavbar, renderBackButton } from '../../shared/ui/layout';
import { authApi, validation, ui } from './utils';

export async function render(container: HTMLElement){
  const headerActions = renderBackButton({ href: '/login', label: 'Back to Login' });
  container.innerHTML = `
    <div class="min-h-screen bg-black relative overflow-hidden text-white">
      ${renderBackground()}

      <div class="relative z-10 min-h-screen flex flex-col">
        ${renderNavbar({
          title: 'Create Account',
          subtitle: 'Set up your player profile to start competing online.',
          rightContent: headerActions,
        })}

        <main class="flex-1 flex items-center justify-center p-3 xs:p-4">
          <div class="relative w-full max-w-sm xs:max-w-md">
            <div class="absolute inset-0 rounded-2xl blur-sm opacity-90 animate-border animate-glow"></div>
            <div class="relative bg-gray-900/90 backdrop-blur-sm rounded-2xl p-6 xs:p-8 border border-gray-700 shadow-2xl">
              <div class="text-center mb-6 xs:mb-8">
                <h1 class="text-2xl xs:text-3xl font-bold text-cyan-400 mb-1 xs:mb-2 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">Join ft_transcendence</h1>
                <p class="text-gray-400 text-sm">Complete the form below to create your account.</p>
              </div>
              <form id="registerForm" class="space-y-4 xs:space-y-6">
                <div><input id="reg-username" type="text" placeholder="Username" class="w-full px-3 xs:px-4 py-2 xs:py-3 bg-gray-800/50 border border-cyan-400/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300" /></div>
                <div><input id="reg-email" type="email" placeholder="Email" class="w-full px-3 xs:px-4 py-2 xs:py-3 bg-gray-800/50 border border-cyan-400/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300" /></div>
                <div><input id="reg-password" type="password" placeholder="Password" class="w-full px-3 xs:px-4 py-2 xs:py-3 bg-gray-800/50 border border-cyan-400/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300" /></div>
                <div><input id="reg-confirm" type="password" placeholder="Confirm Password" class="w-full px-3 xs:px-4 py-2 xs:py-3 bg-gray-800/50 border border-cyan-400/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300" /></div>
                <button type="submit" class="w-full py-2 xs:py-3 bg-gray-800/50 border-2 border-cyan-400 rounded-lg text-cyan-400 font-bold text-base xs:text-lg hover:bg-cyan-400/10 hover:border-cyan-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50 shadow-[0_0_20px_rgba(34,211,238,0.5)] hover:shadow-[0_0_30px_rgba(34,211,238,0.8)]">CREATE ACCOUNT</button>
              </form>
              <div class="mt-6 xs:mt-8 text-center">
                <a href="/login" data-link class="text-pink-400 hover:text-pink-300 text-xs xs:text-sm transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-opacity-50 rounded">Already have an account? Sign in</a>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  const form = container.querySelector('#registerForm') as HTMLFormElement;
  const usernameInput = container.querySelector('#reg-username') as HTMLInputElement;
  const emailInput = container.querySelector('#reg-email') as HTMLInputElement;
  const passwordInput = container.querySelector('#reg-password') as HTMLInputElement;
  const confirmPasswordInput = container.querySelector('#reg-confirm') as HTMLInputElement;
  const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  const originalButtonText = submitButton.textContent || 'REGISTER';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.error-message, .success-message').forEach(m=>m.remove());
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!username) return ui.showError('Username is required');
    if (!validation.username(username)) return ui.showError('Username must be at least 3 characters long');
    if (!email) return ui.showError('Email is required');
    if (!validation.email(email)) return ui.showError('Please enter a valid email address');
    if (!password) return ui.showError('Password is required');
    if (!validation.password(password)) return ui.showError('Password must be at least 6 characters long');
    if (password !== confirmPassword) return ui.showError('Passwords do not match');

    ui.setLoading(submitButton, true);
    try {
      const response = await authApi.register(username, email, password);
      if (response.success && response.data) {
        // Check if token is provided (auto-login)
        if (response.data.token) {
          ui.showSuccess('Registration successful! Logging you in...');
          form.reset();
          setTimeout(()=> (window as any).navigate('/dashboard'), 800);
        } else {
          // Old flow - redirect to login
          ui.showSuccess('Registration successful! Redirecting to login...');
          form.reset();
          setTimeout(()=> (window as any).navigate('/login'), 1200);
        }
      } else ui.showError(response.error || 'Registration failed');
    } catch(err){ console.error(err); ui.showError('Unexpected error'); }
    finally { submitButton.disabled=false; submitButton.textContent=originalButtonText; submitButton.classList.remove('opacity-50','cursor-not-allowed'); }
  });

  const mark = (el: HTMLInputElement, valid: boolean) => { if (valid){ el.classList.remove('border-red-500'); el.classList.add('border-cyan-400/50'); } else { el.classList.add('border-red-500'); el.classList.remove('border-cyan-400/50'); } };
  usernameInput.addEventListener('blur', ()=> mark(usernameInput, !usernameInput.value || validation.username(usernameInput.value.trim())));
  emailInput.addEventListener('blur', ()=> mark(emailInput, !emailInput.value || validation.email(emailInput.value.trim())));
  passwordInput.addEventListener('blur', ()=> mark(passwordInput, !passwordInput.value || validation.password(passwordInput.value)));
  confirmPasswordInput.addEventListener('blur', ()=> mark(confirmPasswordInput, !confirmPasswordInput.value || passwordInput.value === confirmPasswordInput.value));
}


