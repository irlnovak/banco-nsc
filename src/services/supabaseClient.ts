// ============================================================
// supabaseClient — cliente do Supabase (opcional).
// Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.
// Sem essas variáveis, o sistema funciona 100% local.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function env(key: string): string {
  try {
    return (import.meta as unknown as { env?: Record<string, string> }).env?.[key] || '';
  } catch {
    return '';
  }
}

const SUPABASE_URL = env('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = env('VITE_SUPABASE_ANON_KEY');

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Garante uma sessão de autenticação no Supabase (sign-in anônimo).
 * As políticas de RLS exigem um usuário autenticado — mesmo que anônimo —
 * para ler/escrever. Requer "Anonymous sign-ins" ativado no painel
 * (Authentication → Sign In / Providers → Anonymous → ON).
 */
export async function ensureSupabaseSession(): Promise<SupabaseClient | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      const { error } = await sb.auth.signInAnonymously();
      if (error) return null;
    }
    return sb;
  } catch {
    return null;
  }
}
