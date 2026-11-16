// Authentication utilities - shared across all routes
// SECURITY: JWT tokens are stored in httpOnly cookies on the backend
// We rely ONLY on server-side cookie validation - no localStorage/sessionStorage auth checks

/**
 * Validates authentication by checking with the server.
 * This is the ONLY source of truth for authentication.
 * Returns user data if authenticated, null otherwise.
 */
export async function validateAuth(): Promise<any | null> {
  try {
    const res = await fetch('/api/profile/me', { credentials: 'include' });
    
    if (res.ok) {
      const userData = await res.json();
      // Store user data in localStorage ONLY for UI display (not for auth decisions)
      localStorage.setItem('user', JSON.stringify(userData));
      return userData;
    }
    
    // Not authenticated - clear any cached user data
    localStorage.removeItem('user');
    return null;
  } catch (error) {
    console.error('Failed to validate authentication:', error);
    localStorage.removeItem('user');
    return null;
  }
}

/**
 * Gets cached user data from localStorage (for UI purposes only).
 * This is NOT used for authentication decisions.
 */
export function getCachedUser(): any | null {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

/**
 * Clears cached user data.
 * The actual logout must be done by calling the backend logout endpoint.
 */
export function clearCachedUser(): void {
  localStorage.removeItem('user');
}

/**
 * Helper for making authenticated API requests.
 * Automatically includes credentials (httpOnly cookie).
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include',
  });
}
