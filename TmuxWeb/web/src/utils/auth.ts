const TOKEN_KEY = 'tmuxweb_token';

export async function login(token: string): Promise<{ success: boolean; error?: string }> {
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

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
  localStorage.removeItem(TOKEN_KEY);
}

export async function checkAuth(): Promise<boolean> {
  // PWA standalone mode has isolated storage - check if we have the token
  // If no token in localStorage, user needs to re-login even if cookie exists
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return false;
  }
  
  const res = await fetch('/api/profiles', {
    credentials: 'include'
  });
  return res.ok;
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}
