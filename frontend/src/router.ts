// Phase 1/2 SPA router: login, register, 2fa, dashboard, profile, friends, leaderboard, settings, stats
import { initializeNotifications, destroyNotifications } from './shared/notification-manager';
import { validateAuth } from './shared/auth';

export interface PageModule { render(container: HTMLElement): void | Promise<void>; cleanup?(): void; }

const wrap = (p: Promise<any>): Promise<PageModule> => p.then((m) => ({ render: m.render, cleanup: m.cleanup } as PageModule));

const routes: Record<string, () => Promise<PageModule>> = {
  '/login': () => wrap(import('./pages/login/page.ts')),
  '/register': () => wrap(import('./pages/register/page.ts')),
  '/2fa': () => wrap(import('./pages/2fa/page.ts')),
  '/dashboard': () => wrap(import('./pages/dashboard/page.ts')),
  '/profile': () => wrap(import('./pages/profile/page.ts')),
  '/friends': () => wrap(import('./pages/friends/page.ts')),
  '/leaderboard': () => wrap(import('./pages/leaderboard/page.ts')),
  '/settings': () => wrap(import('./pages/settings/page.ts')),
  '/privacy-policy': () => wrap(import('./pages/privacy-policy/page.ts')),
  '/stats': () => wrap(import('./pages/stats/page.ts')),
  '/game': () => wrap(import('./pages/game/page.ts')),
  '/game-online': () => wrap(import('./pages/game-online/page.ts')),
  '/game-ai': () => wrap(import('./pages/game-ai/page.ts')),
  '/tournament': () => wrap(import('./pages/tournament/page.ts')),
  '/tournament/lobby': () => wrap(import('./pages/tournament-lobby/page.ts')),
  '/tournament/brackets': () => wrap(import('./pages/tournament-brackets/page.ts')),
  '/tournament/play': () => wrap(import('./pages/tournament-play/page.ts')),
};

let active: PageModule | null = null;

const protectedRoutes = [
  '/dashboard', '/profile', '/friends', '/leaderboard', '/settings', '/stats',
  '/game', '/game-online', '/game-ai',
  '/tournament', '/tournament/lobby', '/tournament/brackets', '/tournament/play'
];

export async function navigate(path: string, replace = false) {
  const container = document.getElementById('app');
  if (!container) return;
  
  const url = new URL(path, window.location.origin);
  const routePath = url.pathname;
  
  // Route protection: ONLY check httpOnly cookie via server validation
  if (protectedRoutes.includes(routePath)) {
    const user = await validateAuth();
    
    if (!user) {
      console.log('🔒 Not authenticated, redirecting to login');
      destroyNotifications();
      return navigate('/login', true);
    }
    
    console.log('✅ Authenticated as:', user.username);
    initializeNotifications();
  } else {
    destroyNotifications();
  }
  
  const loader = routes[routePath];
  if (!loader) {
    return navigate('/dashboard' + (url.search || ''), true);
  }
  
  if (active?.cleanup) active.cleanup();
  container.innerHTML = '<div class="p-6 text-cyan-300">Loading...</div>';

  const newUrl = routePath + (url.search || '');
  if (replace) history.replaceState({}, '', newUrl); else history.pushState({}, '', newUrl);

  try {
    const mod = await loader();
    active = mod;
    container.innerHTML = '';
    await mod.render(container);
  } catch (e) {
    console.error('Route error', e);
    container.innerHTML = '<div class="p-6 text-red-400">Failed to load page.</div>';
  }
}

window.addEventListener('popstate', () => navigate(location.pathname + (location.search || ''), true));

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a[data-link]') as HTMLAnchorElement | null;
  if (a && a.getAttribute('href')?.startsWith('/')) {
    e.preventDefault();
    navigate(a.getAttribute('href')!);
  }
});

export function bootSpa() {
  if (location.pathname === '/') {
    (async () => {
      const user = await validateAuth();
      const initial = user ? '/dashboard' : '/login';
      navigate(initial + (location.search || ''), true);
    })();
  } else {
    navigate(location.pathname + (location.search || ''), true);
  }
}

;(window as any).navigate = navigate;
