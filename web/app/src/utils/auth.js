const TOKEN_KEY = 'tmuxweb_token';

export async function login(token) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token })
  });
  if (!res.ok) {
    const data = await res.json();
    return { success: false, error: data.message || 'Login failed' };
  }
  localStorage.setItem(TOKEN_KEY, token);
  return { success: true };
}

export async function logout() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
  localStorage.removeItem(TOKEN_KEY);
}

export async function checkAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return false;
  }
  const res = await fetch('/api/profiles', {
    credentials: 'include'
  });
  return res.ok;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}
