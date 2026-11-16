import { validateAuth } from './auth';

/**
 * Pre-fetches user profile data if authenticated.
 * This is purely for performance - it caches user data for UI display.
 * Does NOT affect authentication decisions (those rely on server cookie validation).
 */
export async function prefetchUserData(): Promise<void> {
  if (typeof window === 'undefined') return;

  // Clean up any legacy auth tokens or flags from localStorage/sessionStorage
  localStorage.removeItem('authToken');
  localStorage.removeItem('isLoggedIn');
  sessionStorage.removeItem('sessionValidated');
  sessionStorage.removeItem('authProfileHydrated');

  try {
    await validateAuth();
  } catch (error) {
    console.warn('Failed to prefetch user data:', error);
  }
}
