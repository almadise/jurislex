'use client';

import type { AuthUser } from '@/lib/contracts/matter';

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function apiLogin(email: string, password: string): Promise<AuthUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.erreur || 'Connexion impossible');
  return data.user as AuthUser;
}

export async function apiSignup(input: {
  email: string;
  password: string;
  fullName: string;
  barreauNumber?: string;
}): Promise<AuthUser> {
  // Ne pas envoyer de rôle : l’API force standard (sauf bootstrap local).
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      barreauNumber: input.barreauNumber,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.erreur || 'Inscription impossible');
  return data.user as AuthUser;
}

export async function apiLogout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}
