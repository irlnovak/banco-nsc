// ============================================================
// authService — sessão do usuário.
//
// MODO NUVO (Supabase): a sessão é um JWT gerenciado pelo SDK
// (@supabase/supabase-js) — persistido de forma segura pelo
// próprio cliente, válida em qualquer dispositivo/navegador.
//
// MODO LOCAL (fallback): sessão simples no localStorage.
// ============================================================

import type { User } from '../types';
import { authenticate, isCloudMode, loadSessionUser } from './databaseService';
import { getSupabase } from './supabaseClient';

const SESSION_KEY = 'banco_nsc_session';

export function saveLocalSession(user: User) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, startedAt: Date.now() }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  const sb = getSupabase();
  if (sb) void sb.auth.signOut();
}

/** Login: consulta o banco real (Supabase Auth) no modo nuvem. */
export async function login(loginName: string, senha: string): Promise<{ user?: User; error?: string }> {
  const result = await authenticate(loginName, senha);
  if (result.user && !isCloudMode()) saveLocalSession(result.user);
  return result;
}

/** Restaura a sessão ao abrir o app (qualquer dispositivo). */
export async function restoreSession(): Promise<{ user?: User; salaryCredited: number }> {
  return loadSessionUser();
}
