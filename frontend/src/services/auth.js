// ─── Auth Service ───
// Manages localStorage-based authentication state

const ADMIN_EMAIL = 'admin@richasharma.com';

export function saveSession(data) {
  if (data.accessToken) {
    localStorage.setItem('auth_token', data.accessToken);
    localStorage.setItem('auth_refresh', data.refreshToken);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
  }
}

export function logoutUser() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_refresh');
  localStorage.removeItem('auth_user');
  window.location.reload();
}

export function getCurrentUser() {
  const userStr = localStorage.getItem('auth_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function getAuthToken() {
  return localStorage.getItem('auth_token') || '';
}

export function isAdmin() {
  const user = getCurrentUser();
  return user && user.email === ADMIN_EMAIL;
}

export { ADMIN_EMAIL };
