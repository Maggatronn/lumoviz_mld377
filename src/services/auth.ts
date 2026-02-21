import { API_URL } from './api';

const TOKEN_KEY = 'lumoviz_token';
const USER_KEY = 'lumoviz_user';

export interface AuthUser {
  id: number;
  email: string;
  vanid: string | null;
  displayName: string | null;
  isAdmin: boolean;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('dashboard_selected_organizer');
}

export async function login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Login failed');
  }
  storeAuth(data.token, data.user);
  return { user: data.user, token: data.token };
}

export async function register(email: string, password: string, displayName?: string): Promise<{ user: AuthUser; token: string }> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Registration failed');
  }
  storeAuth(data.token, data.user);
  return { user: data.user, token: data.token };
}

export async function checkAuth(): Promise<AuthUser | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      clearAuth();
      return null;
    }
    const data = await res.json();
    if (!data.success) {
      clearAuth();
      return null;
    }
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  } catch {
    clearAuth();
    return null;
  }
}
